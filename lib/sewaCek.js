/**
 * sewaCek.js - Penanganan masa sewa bot di grup.
 *
 * Dipakai dua jalur:
 *  1. handle/sewa.js  -> saat ada pesan masuk di grup sewa
 *  2. pengecek BERKALA (mulaiCekSewa) -> tiap beberapa menit, tanpa perlu
 *     ada yang chat. Dulu hanya jalur 1 yang ada, jadi grup yang sepi tidak
 *     pernah ditinggalkan bot walau sewanya sudah lama habis.
 *
 * Alur sewa habis:
 *  1. kirim pesan "sewa habis" SEKALI (penandanya disimpan di record sewa,
 *     jadi tidak terulang walau bot restart / keluar gagal lalu diulang),
 *  2. keluar dari grup,
 *  3. data sewa baru dihapus SETELAH bot benar-benar keluar (atau memang sudah
 *     tidak di grup). Dulu data dihapus lebih dulu dan error keluar ditelan,
 *     sehingga bila keluar gagal bot tertinggal di grup selamanya.
 */

import config from '../config.js';
import mess from '../strings.js';
import { findSewa, deleteSewa, updateSewa, listSewa } from './sewa.js';
import { getGroupMetadata, sessions } from './cache.js';
import { listOwner } from './users.js';
import { selisihHari, danger, logTracking } from './utils.js';
import { logLine } from './errorLogger.js';
import { createBoundedSet } from './boundedStore.js';

/** Jumlah hari sebelum habis untuk mengirim peringatan. */
export const HARI_PERINGATAN = 3;

/** Jeda pengecekan berkala. */
const INTERVAL_CEK_MS = 5 * 60 * 1000;
/** Pengecekan pertama setelah connect (beri waktu koneksi stabil). */
const JEDA_CEK_PERTAMA_MS = 60 * 1000;
/** Jeda antar grup saat pengecekan berkala, supaya tidak membanjiri WhatsApp. */
const JEDA_ANTAR_GRUP_MS = 3000;

const catat = (pesan) => {
  console.log(`[SEWA] ${pesan}`);
  logLine('sewa.log', pesan);
};

/** Grup yang sedang diproses — mencegah handler & pengecek berkala bertabrakan. */
const sedangDiproses = new Set();

/** Peringatan yang gagal terkirim tidak diulang tiap 5 menit, cukup sehari sekali. */
const peringatanDicoba = createBoundedSet({ max: 5000, ttl: 24 * 60 * 60 * 1000 });

const jeda = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------ nomor owner ------------------------------ */

/**
 * Cari NOMOR HP owner yang bisa diklik (wa.me/628xx).
 *
 * DATA_OWNER umumnya berisi LID, dan wa.me/<lid> tidak bisa dibuka. Nomor baru
 * dipakai kalau memang terbukti nomor telepon:
 *   1. LID yang sudah dikenal bot -> diterjemahkan ke nomor aslinya
 *   2. entri bukan LID -> ditanyakan ke WhatsApp apakah nomornya terdaftar
 * Kalau tidak ada satu pun yang pasti, hasilnya null dan pemanggil menampilkan
 * petunjuk ".owner" sebagai gantinya.
 */
async function cariNomorOwner(sock) {
  for (const entri of listOwner() || []) {
    const digit = String(entri ?? '').replace(/[^0-9]/g, '');
    if (!digit) continue;

    try {
      const pn = await sock?.signalRepository?.lidMapping?.getPNForLID?.(`${digit}@lid`);
      if (pn) return pn.split('@')[0].split(':')[0];
    } catch {
      // lanjut ke pengecekan berikutnya
    }

    if (String(entri).endsWith('@lid')) continue;

    try {
      const hasil = await sock?.onWhatsApp?.(`${digit}@s.whatsapp.net`);
      if (Array.isArray(hasil) && hasil[0]?.exists === true) return digit;
    } catch {
      // tidak bisa dipastikan -> jangan tampilkan nomor yang mungkin salah
    }
  }
  return null;
}

/** Isi @ownernumber di teks sewa habis: nomor HP, atau petunjuk .owner. */
async function isiNomorOwner(sock, teks) {
  const nomor = await cariNomorOwner(sock);
  if (nomor) return teks.replace(/@ownernumber/g, nomor);

  const petunjuk = `Ketik *${config.prefix?.[0] ?? '.'}owner* untuk melihat kontak owner`;
  return teks
    .replace(/(?:https?:\/\/)?wa\.me\/@ownernumber/gi, petunjuk)
    .replace(/@ownernumber/g, petunjuk);
}

/* ------------------------------ keluar grup ------------------------------ */

/** Galat yang berarti bot memang sudah tidak ada di grup -> dianggap selesai. */
// Sengaja tidak memasukkan 401/403: kode itu juga muncul pada error koneksi,
// dan salah tebak berarti data sewa terhapus padahal bot masih di grup.
const SUDAH_TIDAK_DI_GRUP = /item-not-found|not.*(member|participant)|\bgone\b|\b404\b|\b406\b/i;

/**
 * Keluar dari grup dengan percobaan ulang.
 * @returns {Promise<{ok: boolean, alasan?: string}>}
 */
async function keluarGrup(sock, groupId, maks = 3) {
  let galat = null;
  for (let percobaan = 1; percobaan <= maks; percobaan++) {
    try {
      logTracking(`Sewa - keluar dari grup ${groupId}`);
      await sock.groupLeave(groupId);
      return { ok: true };
    } catch (err) {
      galat = err;
      const teks = String(err?.message || err);
      if (SUDAH_TIDAK_DI_GRUP.test(teks)) return { ok: true, alasan: `bot sudah tidak di grup (${teks})` };
      catat(`${groupId} gagal keluar (percobaan ${percobaan}/${maks}): ${teks}`);
      if (percobaan < maks) await jeda(2000 * percobaan);
    }
  }
  return { ok: false, alasan: String(galat?.message || galat) };
}

const mentionPeserta = async (sock, groupId) => {
  try {
    const metadata = await getGroupMetadata(sock, groupId);
    return (metadata?.participants || []).map((p) => p.id).filter(Boolean);
  } catch {
    return [];
  }
};

/* ------------------------------ proses utama ------------------------------ */

/**
 * Sewa habis: kirim pesan (sekali), keluar grup, lalu hapus data sewa.
 * Aman dipanggil berulang — bila keluar gagal, panggilan berikutnya hanya
 * mencoba keluar lagi tanpa mengirim ulang pesannya.
 *
 * @param {object} [quoted] pesan yang dibalas (jalur handler), opsional
 * @returns {Promise<boolean>} true bila bot sudah keluar & data dihapus
 */
export async function prosesSewaHabis(sock, groupId, dataSewa, quoted) {
  if (sedangDiproses.has(groupId)) return false;
  sedangDiproses.add(groupId);

  try {
    if (dataSewa.outNotified !== dataSewa.expired && mess.handler.sewa_out) {
      try {
        const teks = await isiNomorOwner(sock, mess.handler.sewa_out);
        logTracking(`Sewa - kirim notif sewa habis ke ${groupId}`);
        await sock.sendMessage(
          groupId,
          { text: teks, mentions: await mentionPeserta(sock, groupId) },
          quoted ? { quoted } : {},
        );
      } catch (err) {
        // Pesan gagal (mis. bot sudah dikeluarkan) tidak boleh menahan proses keluar.
        catat(`${groupId} pesan sewa habis gagal terkirim: ${err?.message || err}`);
      }
      await updateSewa(groupId, { outNotified: dataSewa.expired });
    }

    const hasil = await keluarGrup(sock, groupId);
    if (!hasil.ok) {
      catat(`${groupId} GAGAL keluar grup, akan dicoba lagi otomatis: ${hasil.alasan}`);
      danger('Sewa Habis', `Gagal keluar grup : ${groupId} (dicoba lagi nanti)`);
      return false;
    }

    await deleteSewa(groupId);
    catat(`${groupId} sewa habis -> keluar grup${hasil.alasan ? ` (${hasil.alasan})` : ''}, data sewa dihapus`);
    danger('Sewa Habis', `Berhasil keluar Grub :  ${groupId}`);
    return true;
  } finally {
    sedangDiproses.delete(groupId);
  }
}

/**
 * Peringatan sewa akan habis (sekali per periode sewa; penandanya disimpan di
 * record sewa, jadi tidak terulang walau bot restart).
 * @returns {Promise<boolean>} true bila peringatan terkirim
 */
export async function kirimPeringatanSewa(sock, groupId, dataSewa, quoted) {
  if (dataSewa.notifiedExpired === dataSewa.expired) return false;
  if (!mess.handler.sewa_notif) return false;
  if (sedangDiproses.has(groupId) || peringatanDicoba.has(groupId)) return false;

  // Klaim SEBELUM await apa pun, supaya pesan yang masuk bersamaan tidak
  // sama-sama mengirim peringatan.
  sedangDiproses.add(groupId);
  peringatanDicoba.add(groupId);

  try {
    const teks = mess.handler.sewa_notif.replace('@date', selisihHari(dataSewa.expired));
    logTracking(`Sewa - kirim notif sewa ke ${groupId}`);
    await sock.sendMessage(
      groupId,
      { text: teks, mentions: await mentionPeserta(sock, groupId) },
      quoted ? { quoted } : {},
    );
    await updateSewa(groupId, { notifiedExpired: dataSewa.expired });
    catat(`${groupId} peringatan sewa (${selisihHari(dataSewa.expired)}) terkirim`);
    return true;
  } catch (err) {
    catat(`${groupId} peringatan sewa gagal terkirim: ${err?.message || err}`);
    return false;
  } finally {
    sedangDiproses.delete(groupId);
  }
}

/** Status sewa sebuah record: 'habis' | 'segera' | 'aktif'. */
export function statusSewa(dataSewa, now = Date.now()) {
  const sisa = Number(dataSewa?.expired) - now;
  if (!Number.isFinite(sisa)) return 'aktif'; // data rusak: jangan keluar sembarangan
  if (sisa <= 0) return 'habis';
  if (sisa <= HARI_PERINGATAN * 24 * 60 * 60 * 1000) return 'segera';
  return 'aktif';
}

/* --------------------------- pengecek berkala --------------------------- */

let timer = null;
let berjalan = false;

/** Socket sesi utama saat ini (berganti setiap reconnect). */
function sockUtama() {
  return sessions.get('session') || null;
}

/**
 * Periksa SEMUA grup sewa sekali jalan.
 * @returns {Promise<{habis: number, keluar: number, peringatan: number}>}
 */
export async function cekSewaSekarang(sock = sockUtama()) {
  const ringkasan = { habis: 0, keluar: 0, peringatan: 0 };
  if (berjalan) return ringkasan;
  if (!sock || (sock.sessionReady && !sock.sessionReady())) return ringkasan;

  berjalan = true;
  try {
    const semua = (await listSewa()) || {};
    const now = Date.now();

    for (const [groupId, dataSewa] of Object.entries(semua)) {
      if (!groupId.endsWith('@g.us')) continue;
      const status = statusSewa(dataSewa, now);

      if (status === 'habis') {
        ringkasan.habis++;
        if (await prosesSewaHabis(sock, groupId, dataSewa)) ringkasan.keluar++;
        await jeda(JEDA_ANTAR_GRUP_MS);
      } else if (status === 'segera') {
        if (await kirimPeringatanSewa(sock, groupId, dataSewa)) {
          ringkasan.peringatan++;
          await jeda(JEDA_ANTAR_GRUP_MS);
        }
      }
    }
  } catch (err) {
    catat(`pengecekan berkala error: ${err?.message || err}`);
  } finally {
    berjalan = false;
  }

  if (ringkasan.habis || ringkasan.peringatan) {
    catat(
      `cek berkala: ${ringkasan.habis} sewa habis (${ringkasan.keluar} sudah keluar), ` +
        `${ringkasan.peringatan} peringatan dikirim`,
    );
  }
  return ringkasan;
}

/**
 * Nyalakan pengecek berkala. Aman dipanggil di setiap connect: hanya satu
 * timer yang hidup, dan socket diambil ulang tiap putaran.
 */
export function mulaiCekSewa() {
  setTimeout(() => cekSewaSekarang().catch(() => {}), JEDA_CEK_PERTAMA_MS);
  if (timer) return;
  timer = setInterval(() => cekSewaSekarang().catch(() => {}), INTERVAL_CEK_MS);
  timer.unref?.();
}
