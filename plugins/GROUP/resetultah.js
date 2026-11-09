import mess from '../../strings.js';
import { getGroupMetadata } from '../../lib/cache.js';
import { findUser, updateUser, getAllUsersWithBirthday } from '../../lib/users.js';
import { isOwner } from '../../lib/users.js';

/**
 * `.resetultah`      -> hapus data ulang tahun SEMUA member grup ini (khusus admin)
 * `.resetultah all`  -> hapus data ulang tahun SELURUH user (khusus owner)
 *
 * Data ulang tahun disimpan di record user (global), jadi "reset per grup"
 * berarti membersihkan birthday milik user yang menjadi member grup ini.
 */
async function clearBirthday(jid) {
  const found = await findUser(jid);
  if (!found) return false;
  const userData = Array.isArray(found) ? found[1] : found;
  if (!userData?.birthday) return false;

  await updateUser(jid, { birthday: null, birthYear: null, lastBirthdayWish: null });
  return true;
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, sender, isGroup, content } = messageInfo;

  const mode = (content || '').trim().toLowerCase();

  // ===== Reset global (owner) =====
  if (mode === 'all') {
    if (!isOwner(sender)) {
      return sock.sendMessage(remoteJid, { text: mess.general.isOwner }, { quoted: message });
    }

    const all = getAllUsersWithBirthday();
    let total = 0;
    for (const [id] of all) {
      try {
        if (await clearBirthday(id)) total++;
      } catch {
        /* lewati user yang gagal */
      }
    }

    return sock.sendMessage(
      remoteJid,
      { text: `♻️ _Berhasil menghapus data ulang tahun ${total} user (global)._` },
      { quoted: message },
    );
  }

  // ===== Reset per grup (admin) =====
  if (!isGroup) {
    return sock.sendMessage(remoteJid, { text: mess.general.isGroup }, { quoted: message });
  }

  const groupMetadata = await getGroupMetadata(sock, remoteJid);
  const participants = groupMetadata.participants || [];
  const isAdmin = participants.some(
    (p) => (p.phoneNumber === sender || p.id === sender) && p.admin,
  );
  if (!isAdmin) {
    return sock.sendMessage(remoteJid, { text: mess.general.isAdmin }, { quoted: message });
  }

  let total = 0;
  const sudah = new Set();
  for (const p of participants) {
    for (const ident of [p.id, p.phoneNumber]) {
      if (!ident || sudah.has(ident)) continue;
      sudah.add(ident);
      try {
        if (await clearBirthday(ident)) total++;
      } catch {
        /* lewati */
      }
    }
  }

  return sock.sendMessage(
    remoteJid,
    {
      text:
        total > 0
          ? `♻️ _Berhasil menghapus data ulang tahun ${total} member di grup ini._`
          : `ℹ️ _Tidak ada member grup ini yang punya data ulang tahun._`,
    },
    { quoted: message },
  );
}

export default {
  handle,
  Commands: ['resetultah'],
  OnlyPremium: false,
  OnlyOwner: false,
};
