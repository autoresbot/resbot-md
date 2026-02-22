import { logTracking } from './utils.js';

let groupCache = {};
let profilePictureCache = {};
let groupFetchCache = {};
const sessions = new Map();

const DEFAULT_PROFILE_PICTURE_URL = 'https://api.autoresbot.com/api/maker/pp-default';
const CACHE_TIME = 60; // menit
const CACHE_METADATA = CACHE_TIME * 60000;
const CACHE_groupFetch = CACHE_TIME * 60000; // 1 menit (60000 ms)

let metadataLocks = {};

const getGroupMetadata = async (sock, remoteJid) => {
  if (remoteJid.endsWith('@broadcast') || remoteJid.endsWith('@status.broadcast')) {
    return null;
  }

  if (groupCache[remoteJid]) {
    return groupCache[remoteJid];
  }

  if (metadataLocks[remoteJid]) {
    return metadataLocks[remoteJid];
  }

  metadataLocks[remoteJid] = (async () => {
    try {
      const metadata = await sock.groupMetadata(remoteJid);

      groupCache[remoteJid] = {
        ...metadata,
        last_update: Date.now(),
      };

      setTimeout(() => delete groupCache[remoteJid], CACHE_METADATA);

      return groupCache[remoteJid];
    } finally {
      delete metadataLocks[remoteJid];
    }
  })();

  return metadataLocks[remoteJid];
};

const getProfilePictureUrl = async (sock, sender) => {
  if (profilePictureCache[sender]) {
    return profilePictureCache[sender];
  }

  try {
    const url = await sock.profilePictureUrl(sender, 'image');
    profilePictureCache[sender] = url || DEFAULT_PROFILE_PICTURE_URL;
  } catch (err) {
    profilePictureCache[sender] = DEFAULT_PROFILE_PICTURE_URL;
  }

  setTimeout(() => delete profilePictureCache[sender], CACHE_METADATA);

  return profilePictureCache[sender];
};

const groupFetchAllParticipating = async (sock) => {
  try {
    const chats = Object.values(sock.store?.chats || {});

    const groups = chats
      .filter((chat) => chat.id.endsWith('@g.us'))
      .reduce((acc, chat) => {
        acc[chat.id] = {
          id: chat.id,
          subject: chat.name || 'Unknown Group',
        };
        return acc;
      }, {});

    return groups;
  } catch (err) {
    console.error('Light group fetch error:', err.message);
    return {};
  }
};

// Fungsi untuk menghapus cache sebelum waktunya
const clearGroupCache = (remoteJid) => {
  if (groupCache[remoteJid]) {
    delete groupCache[remoteJid];
  }
};

const updateParticipant = async (sock, remoteJid, participants, action = 'add') => {
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
    let number = p.id || p.phoneNumber || p; // fallback: kalau p memang string

    // Deteksi otomatis suffix (@s.whatsapp.net atau @lid)
    let jid;
    if (typeof number === 'string' && number.includes('@')) {
      jid = number;
    } else {
      jid = `${number}@s.whatsapp.net`;
    }

    // Ambil nomor tanpa suffix
    const targetNumber = jid.split('@')[0];

    const normalizeJid = (jid) => jid?.split('@')[0];

    const index = group.participants.findIndex((gp) => normalizeJid(gp.id) === normalizeJid(jid));

    if (action === 'add') {
      if (index === -1) {
        group.participants.push({ id: jid, admin: p.admin ?? null });
      }
    } else if (action === 'remove') {
      if (index !== -1) {
        group.participants.splice(index, 1);
      }
    } else if (action === 'promote') {
      if (index !== -1) {
        group.participants[index].admin = 'admin';
      } else {
        group.participants.push({ id: jid, admin: 'admin' });
      }
    } else if (action === 'demote') {
      if (index !== -1) {
        group.participants[index].admin = null;
      }
    }
  });

  // Update ukuran dan waktu terakhir
  group.size = group.participants.length;
  group.last_update = Date.now();
  //console.log('FINAL Updated group participants:', group.participants);
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
