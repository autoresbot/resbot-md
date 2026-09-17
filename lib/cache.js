import { logTracking } from './utils.js';

let groupCache = {};
let profilePictureCache = {};
let groupFetchCache = {};
const groupTimeout = {};
const sessions = new Map();

const DEFAULT_PROFILE_PICTURE_URL = 'https://api.autoresbot.com/api/maker/pp-default';
const CACHE_TIME = 60; // menit
const CACHE_METADATA = CACHE_TIME * 60000;

/** Permintaan metadata yang sedang berjalan, supaya tidak ditembak berkali-kali. */
const metadataInflight = new Map();

/** Grup yang metadatanya baru saja gagal diambil -> jeda sebelum dicoba lagi. */
const metadataGagal = new Map();
const JEDA_GAGAL_METADATA = 60 * 1000; // 1 menit

/** Penanda agar log kegagalan tidak membanjiri console. */
const logGagalTerakhir = new Map();
const JEDA_LOG_GAGAL = 5 * 60 * 1000; // 5 menit per grup

/**
 * Catat kegagalan metadata SEKALI per grup tiap 5 menit, lengkap dengan
 * alasannya. Versi lama mencetak tiap kali gagal dan tanpa pesan error sama
 * sekali (`...untuk <jid>:` lalu kosong), jadi console penuh tapi tidak
 * memberi tahu apa pun.
 */
function logGagalMetadata(remoteJid, err) {
  const now = Date.now();
  const terakhir = logGagalTerakhir.get(remoteJid) ?? 0;
  if (now - terakhir < JEDA_LOG_GAGAL) return;

  logGagalTerakhir.set(remoteJid, now);
  console.error(
    `Gagal mengambil metadata grup ${remoteJid}: ${err?.message || err}` +
      ` (dicoba lagi setelah ${JEDA_GAGAL_METADATA / 1000} detik)`,
  );
}
const CACHE_groupFetch = CACHE_TIME * 60000; // 1 menit (60000 ms)

const getGroupMetadata = async (sock, remoteJid) => {
  // Cek apakah remoteJid adalah broadcast, return null jika iya
  if (remoteJid.endsWith('@status.broadcast') || remoteJid.endsWith('@broadcast')) {
    console.warn(`Lewati pengambilan metadata untuk broadcast: ${remoteJid}`);
    return null;
  }

  if (groupCache[remoteJid]) return groupCache[remoteJid];

  // Baru saja gagal? Jangan tanya server lagi dulu.
  //
  // Dulu kegagalan TIDAK dicatat sama sekali, jadi tiap pesan berikutnya
  // langsung mencoba lagi. Di 50 grup yang ramai, itu berubah jadi banjir
  // query + banjir log "Gagal mengambil metadata".
  const gagalSampai = metadataGagal.get(remoteJid);
  if (gagalSampai && Date.now() < gagalSampai) return null;

  // Permintaan untuk grup yang sama digabung jadi satu.
  //
  // Sebelumnya cache baru diisi SETELAH `await`, sehingga beberapa pesan yang
  // masuk hampir bersamaan di grup yang sama sama-sama lolos pengecekan dan
  // masing-masing menembak groupMetadata sendiri. Dengan 50 grup itu jadi
  // puluhan query serentak — sumber utama rate limit/timeout-nya.
  const sedangJalan = metadataInflight.get(remoteJid);
  if (sedangJalan) return sedangJalan;

  const permintaan = (async () => {
    try {
      logTracking(`Cache.js - groupMetadata1 (${remoteJid})`);
      const metadata = await sock.groupMetadata(remoteJid);

      groupCache[remoteJid] = { ...metadata, last_update: Date.now() };
      setTimeout(() => delete groupCache[remoteJid], CACHE_METADATA);
      metadataGagal.delete(remoteJid);

      return groupCache[remoteJid];
    } catch (err) {
      metadataGagal.set(remoteJid, Date.now() + JEDA_GAGAL_METADATA);
      logGagalMetadata(remoteJid, err);
      return null;
    } finally {
      metadataInflight.delete(remoteJid);
    }
  })();

  metadataInflight.set(remoteJid, permintaan);
  return permintaan;
};

// const getProfilePictureUrl = async (sock, sender) => {
//   if (!profilePictureCache[sender]) {
//     try {
//       const url = await sock.profilePictureUrl(sender, 'image');
//       profilePictureCache[sender] = url || DEFAULT_PROFILE_PICTURE_URL;
//     } catch {
//       profilePictureCache[sender] = DEFAULT_PROFILE_PICTURE_URL;
//     }
//     setTimeout(() => delete profilePictureCache[sender], CACHE_METADATA); // Cache 1 menit
//   }
//   return profilePictureCache[sender];
// };
const PROFILE_CACHE_TTL = 15 * 60 * 1000; // 15 menit

const getProfilePictureUrl = async (sock, sender) => {
  const now = Date.now();

  // Cek cache
  const cached = profilePictureCache[sender];
  if (cached && cached.expireAt > now) {
    return cached.url;
  }

  try {
    const url = await Promise.race([
      sock.profilePictureUrl(sender, 'image'),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile picture timeout')), 10000),
      ),
    ]);

    profilePictureCache[sender] = {
      url: url || DEFAULT_PROFILE_PICTURE_URL,
      expireAt: now + PROFILE_CACHE_TTL,
    };

    return profilePictureCache[sender].url;
  } catch (error) {
    console.error(`Gagal mengambil foto profil ${sender}:`, error.message);

    // Cache fallback juga supaya tidak retry terus
    profilePictureCache[sender] = {
      url: DEFAULT_PROFILE_PICTURE_URL,
      expireAt: now + PROFILE_CACHE_TTL,
    };

    return DEFAULT_PROFILE_PICTURE_URL;
  }
};

const groupFetchAllParticipating = async (sock) => {
  // Jika cache global tidak ada, ambil data
  if (!groupFetchCache['global']) {
    try {
      // Ambil data partisipasi grup
      const data = await sock.groupFetchAllParticipating();

      // Simpan data ke cache
      groupFetchCache['global'] = data;

      // Hapus cache setelah 10 menit
      setTimeout(() => {
        delete groupFetchCache['global'];
      }, CACHE_groupFetch);
    } catch (error) {
      console.error('Error fetching group participation:', error.message);
      return false;
    }
  }
  return groupFetchCache['global'];
};

// Fungsi untuk menghapus cache sebelum waktunya
const clearGroupCache = (remoteJid) => {
  if (groupCache[remoteJid]) {
    delete groupCache[remoteJid];
  }
};

/**
 * Ambil bagian nomor dari sebuah jid/nomor: "628xx@s.whatsapp.net" -> "628xx",
 * "6924xx:12@lid" -> "6924xx". Nilai yang bukan string -> null.
 */
const nomorDari = (nilai) => {
  if (typeof nilai !== 'string' || !nilai) return null;
  const depan = nilai.split('@')[0].split(':')[0];
  return depan || null;
};

/**
 * Cocokkan peserta dengan nomor target lewat SEMUA bentuk identitasnya.
 *
 * Grup ber-alamat LID menyimpan peserta dengan `id`/`jid` berupa LID
 * (`6924xx@lid`), sedangkan event `group-participants.update` mengirim nomor
 * telepon (`628xx@s.whatsapp.net`). Versi lama hanya membandingkan `gp.id`,
 * jadi di grup seperti itu peserta yang dipromote/didemote TIDAK PERNAH
 * ketemu — cache tetap menyimpan status admin yang lama sampai TTL 60 menit
 * habis, dan bot masih menganggapnya user biasa.
 */
const pesertaCocok = (gp, targetNumber) =>
  [gp.id, gp.jid, gp.lid, gp.phoneNumber].some((nilai) => nomorDari(nilai) === targetNumber);

/**
 * Apakah salah satu identitas (nomor telepon / LID) ini seorang admin grup?
 *
 * Dipakai bersama supaya pengecekan admin tidak lagi bergantung pada SATU
 * bentuk jid: grup ber-alamat LID menyimpan peserta sebagai `@lid` sementara
 * pengirim kerap dikenali lewat nomor teleponnya (atau sebaliknya).
 */
const pesertaAdalahAdmin = (participants, ...identitas) => {
  const target = identitas.map(nomorDari).filter(Boolean);
  if (!target.length) return false;
  return (participants || []).some(
    (gp) => gp?.admin && target.some((nomor) => pesertaCocok(gp, nomor)),
  );
};

const updateParticipant = async (sock, remoteJid, participants, action = 'add') => {
  // Dulu blok pengambilan metadata ditulis ulang di sini dengan pola lama
  // (tanpa dedup, tanpa jeda gagal). Sekarang memakai getGroupMetadata yang
  // sama, jadi penggabungan permintaan & jeda kegagalannya ikut berlaku.
  const group = await getGroupMetadata(sock, remoteJid);
  if (!group) return;

  let cacheBasi = false;

  participants.forEach((p) => {
    // Ambil nilai yang pasti string
    let number = p.id || p.phoneNumber || p; // fallback: kalau p memang string

    // Deteksi otomatis suffix (@s.whatsapp.net atau @lid)
    let jid;
    if (typeof number === 'string' && number.includes('@')) {
      jid = number;
    } else {
      jid = `${number}@s.whatsapp.net`;
    }

    // Ambil nomor tanpa suffix (dan tanpa penanda device)
    const targetNumber = nomorDari(jid);
    if (!targetNumber) return;

    const index = group.participants.findIndex((gp) => pesertaCocok(gp, targetNumber));

    if (action === 'add') {
      if (index === -1) {
        // `phoneNumber` ikut diisi kalau jid-nya memang nomor telepon, sebab
        // checkIfAdmin() membandingkan pengirim dengan `id` ATAU `phoneNumber`.
        group.participants.push({
          id: jid,
          admin: null,
          ...(jid.endsWith('@s.whatsapp.net') ? { phoneNumber: jid } : {}),
        });
      }
    } else if (action === 'remove') {
      if (index !== -1) {
        group.participants.splice(index, 1);
      }
    } else if (action === 'promote' || action === 'demote') {
      if (index !== -1) {
        group.participants[index].admin = action === 'promote' ? 'admin' : null;
      } else {
        // Pesertanya tidak terpetakan (bentuk jid baru / peserta belum ada di
        // cache). Daripada menyimpan status admin yang salah sampai TTL habis,
        // cache grup dibuang supaya permintaan berikutnya mengambil data segar.
        cacheBasi = true;
      }
    }
  });

  // Update ukuran dan waktu terakhir
  group.size = group.participants.length;
  group.last_update = Date.now();

  // Simpan ulang ke cache (sebenarnya sudah reference, tapi kita refresh TTL)
  groupCache[remoteJid] = group;

  if (cacheBasi) clearGroupCache(remoteJid);
};

const findParticipantLatest = (number) => {
  // FIX: startup match error - validasi number harus string sebelum .match()
  if (typeof number !== 'string') return null;

  // Ambil hanya angka saja dari number
  const targetNumber = (number.match(/^\d+/) || [])[0];
  if (!targetNumber) return null; // kalau number tidak valid

  let latestGroup = null;
  let latestTime = 0;

  for (const groupId in groupCache) {
    const group = groupCache[groupId];

    // Cari participant yang angkanya sama, tanpa peduli suffix
    const participant = group.participants?.find((p) => {
      // FIX: startup match error - p.id bisa undefined
      if (typeof p?.id !== 'string') return false;
      const pNumber = (p.id.match(/^\d+/) || [])[0];
      return pNumber === targetNumber;
    });

    if (participant && group.last_update > latestTime) {
      latestGroup = {
        groupId: group.id,
        subject: group.subject,
        last_update: group.last_update,
        participant,
        total_participants: group.size,
      };
      latestTime = group.last_update;
    }
  }

  return latestGroup;
};

export {
  getGroupMetadata,
  pesertaAdalahAdmin,
  nomorDari,
  getProfilePictureUrl,
  groupFetchAllParticipating,
  clearGroupCache,
  updateParticipant,
  findParticipantLatest,
  sessions,
};
