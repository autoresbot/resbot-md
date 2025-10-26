import { logTracking } from "./utils.js";

let groupCache = {};
let profilePictureCache = {};
let groupFetchCache = {};
const sessions = new Map();

const DEFAULT_PROFILE_PICTURE_URL =
  "https://api.autoresbot.com/api/maker/pp-default";
const CACHE_TIME = 60; // menit
const CACHE_METADATA = CACHE_TIME * 60000;
const CACHE_groupFetch = CACHE_TIME * 60000; // 1 menit (60000 ms)

const getGroupMetadata = async (sock, remoteJid) => {
  // Cek apakah remoteJid adalah broadcast, return null jika iya
  if (
    remoteJid.endsWith("@status.broadcast") ||
    remoteJid.endsWith("@broadcast")
  ) {
    console.warn(`Lewati pengambilan metadata untuk broadcast: ${remoteJid}`);
    return null;
  }

  if (!groupCache[remoteJid]) {
    try {
      logTracking(`Cache.js - groupMetadata1 (${remoteJid})`);
      const metadata = await sock.groupMetadata(remoteJid); // @status.broadcast
      groupCache[remoteJid] = {
        ...metadata,
        last_update: Date.now(),
      };
      setTimeout(() => delete groupCache[remoteJid], CACHE_METADATA);
    } catch (err) {
      console.error(`3: Gagal mengambil metadata untuk ${remoteJid}:`, err);
      return null;
    }
  }
  return groupCache[remoteJid];
};

const getProfilePictureUrl = async (sock, sender) => {
  if (!profilePictureCache[sender]) {
    try {
      const url = await sock.profilePictureUrl(sender, "image");
      profilePictureCache[sender] = url || DEFAULT_PROFILE_PICTURE_URL;
    } catch {
      profilePictureCache[sender] = DEFAULT_PROFILE_PICTURE_URL;
    }
    setTimeout(() => delete profilePictureCache[sender], CACHE_METADATA); // Cache 1 menit
  }
  return profilePictureCache[sender];
};

const groupFetchAllParticipating = async (sock) => {
  // Jika cache global tidak ada, ambil data
  if (!groupFetchCache["global"]) {
    try {
      // Ambil data partisipasi grup
      const data = await sock.groupFetchAllParticipating();

      // Simpan data ke cache
      groupFetchCache["global"] = data;

      // Hapus cache setelah 10 menit
      setTimeout(() => {
        delete groupFetchCache["global"];
      }, CACHE_groupFetch);
    } catch (error) {
      console.error("Error fetching group participation:", error.message);
      return false;
    }
  }
  return groupFetchCache["global"];
};

// Fungsi untuk menghapus cache sebelum waktunya
const clearGroupCache = (remoteJid) => {
  if (groupCache[remoteJid]) {
    delete groupCache[remoteJid];
  }
};

const updateParticipant = async (
  sock,
  remoteJid,
  participants,
  action = "add"
) => {
  if (!groupCache[remoteJid]) {
    try {
      logTracking(`Cache.js - groupMetadata2 (${remoteJid})`);
      const metadata = await sock.groupMetadata(remoteJid);
      groupCache[remoteJid] = {
        ...metadata,
        last_update: Date.now(),
      };
      setTimeout(() => delete groupCache[remoteJid], CACHE_METADATA);
    } catch (err) {
      console.error(`2: Gagal mengambil metadata grup ${remoteJid}:`, err.message);
      return; // Hentikan fungsi jika metadata gagal diambil
    }
  }

  const group = groupCache[remoteJid];
  if (!group) return;



 participants.forEach((p) => {
  // Ambil nilai yang pasti string
  let number = p.phoneNumber || p.id || p; // fallback: kalau p memang string
  
  // Deteksi otomatis suffix (@s.whatsapp.net atau @lid)
  let jid;
  if (typeof number === "string" && number.includes("@")) {
    jid = number;
  } else {
    jid = `${number}@s.whatsapp.net`;
  }

  // Ambil nomor tanpa suffix
  const targetNumber = jid.split("@")[0];

  const index = group.participants.findIndex((gp) => {
    const pNumber = gp.id.split("@")[0];
    return pNumber === targetNumber;
  });

  if (action === "add") {
    if (index === -1) {
      group.participants.push({ id: jid, admin: null });
    }
  } else if (action === "remove") {
    if (index !== -1) {
      group.participants.splice(index, 1);
    }
  } else if (action === "promote") {
    if (index !== -1) {
      group.participants[index].admin = "admin";
    }
  } else if (action === "demote") {
    if (index !== -1) {
      group.participants[index].admin = null;
    }
  }
});


  // Update ukuran dan waktu terakhir
  group.size = group.participants.length;
  group.last_update = Date.now();
};

const findParticipantLatest = (number) => {
  // Ambil hanya angka saja dari number
  const targetNumber = (number.match(/^\d+/) || [])[0];
  if (!targetNumber) return null; // kalau number tidak valid

  let latestGroup = null;
  let latestTime = 0;

  for (const groupId in groupCache) {
    const group = groupCache[groupId];

    // Cari participant yang angkanya sama, tanpa peduli suffix
    const participant = group.participants?.find((p) => {
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
  getProfilePictureUrl,
  groupFetchAllParticipating,
  clearGroupCache,
  updateParticipant,
  findParticipantLatest,
  sessions,
};
