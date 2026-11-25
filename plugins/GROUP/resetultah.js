import mess from '../../strings.js';
import { getGroupMetadata, pesertaAdalahAdmin } from '../../lib/cache.js';
import { isOwner, getAllUsersWithBirthday, updateUser } from '../../lib/users.js';
import { hapusUltahGrup, hapusUltahSemua } from '../../lib/ultahGrup.js';

/**
 * `.resetultah`      -> hapus data ulang tahun GRUP INI SAJA (admin)
 * `.resetultah all`  -> hapus data ulang tahun di SEMUA grup (owner)
 *
 * Data ulang tahun disimpan per grup (lib/ultahGrup.js), jadi reset di satu
 * grup tidak menyentuh data grup lain — walau orangnya anggota kedua grup.
 */
async function handle(sock, messageInfo) {
  const { remoteJid, message, sender, senderLid, isGroup, content } = messageInfo;

  const mode = (content || '').trim().toLowerCase();
  const balas = (text) => sock.sendMessage(remoteJid, { text }, { quoted: message });

  // ===== Reset semua grup (owner) =====
  if (mode === 'all') {
    if (!isOwner(senderLid) && !isOwner(sender)) return balas(mess.general.isOwner);

    const total = hapusUltahSemua();

    // Data lama (global, sebelum per grup) ikut dibersihkan supaya tidak
    // dipindahkan lagi ke grup yang belum pernah membuka .listultah.
    for (const [id] of getAllUsersWithBirthday() || []) {
      try {
        await updateUser(id, { birthday: null, birthYear: null, lastBirthdayWish: null });
      } catch {
        /* lewati user yang gagal */
      }
    }

    return balas(`♻️ _Berhasil menghapus ${total} data ulang tahun di semua grup._`);
  }

  // ===== Reset grup ini (admin) =====
  if (!isGroup) return balas(mess.general.isGroup);

  const groupMetadata = await getGroupMetadata(sock, remoteJid);
  const isAdmin =
    pesertaAdalahAdmin(groupMetadata?.participants, sender, senderLid) ||
    isOwner(senderLid) ||
    isOwner(sender);
  if (!isAdmin) return balas(mess.general.isAdmin);

  const total = hapusUltahGrup(remoteJid);

  return balas(
    total > 0
      ? `♻️ _Berhasil menghapus ${total} data ulang tahun di grup ini._\n_Data di grup lain tidak terpengaruh._`
      : `ℹ️ _Belum ada data ulang tahun di grup ini._`,
  );
}

export default {
  handle,
  Commands: ['resetultah'],
  OnlyPremium: false,
  OnlyOwner: false,
};
