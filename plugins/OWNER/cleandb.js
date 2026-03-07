import { reply } from "../../lib/utils.js";
import { resetMemberOld } from "../../lib/users.js";
import { readGroup, replaceGroup } from "../../lib/group.js";

async function handle(sock, messageInfo) {
  const { m, prefix, command, content, mentionedJid } = messageInfo;

  try {
    // Validasi jika tidak ada argumen
    if (!content || !content.trim()) {
      return await reply(
        m,
        `_⚠️ Fitur ini akan menghapus:_\n` +
          `• Data grup yang sudah keluar dari bot\n` +
          `• Data user yang tidak aktif selama lebih dari 30 hari\n\n` +
          `_💡 Cara pakai:_\n*${prefix + command} -y*`
      );
    }

    if (content == "-y") {
      const allGroups = await sock.groupFetchAllParticipating();
      const activeGroupIds = Object.keys(allGroups);

      // Validasi: pastikan fetch berhasil mendapatkan data
      if (!activeGroupIds || activeGroupIds.length === 0) {
        return await reply(
          m,
          `_⚠️ Gagal mengambil daftar grup aktif. Coba lagi nanti._`
        );
      }

      // Ambil semua data group tersimpan
      const savedGroups = await readGroup();
      const savedGroupIds = Object.keys(savedGroups);

      // Buat objek baru hanya dengan grup yang masih aktif
      const filteredGroups = {};
      for (const groupId of activeGroupIds) {
        if (savedGroups[groupId]) {
          filteredGroups[groupId] = savedGroups[groupId];
        }
      }

      const removedCount = savedGroupIds.length - Object.keys(filteredGroups).length;

      // Validasi: jangan hapus semua jika terlalu banyak yang akan dihapus
      if (removedCount > 0 && Object.keys(filteredGroups).length === 0) {
        return await reply(
          m,
          `_⚠️ Semua ${savedGroupIds.length} grup akan dihapus. Ini kemungkinan error. Proses dibatalkan._`
        );
      }

      // Replace isi database dengan hanya grup aktif
      await replaceGroup(filteredGroups);

      await resetMemberOld();

      return await reply(m, `_✅ Berhasil Membersihkan DB (${removedCount} grup dihapus, ${Object.keys(filteredGroups).length} grup tersisa)_`);
    }
  } catch (error) {
    console.error("Error handling command:", error);
    return await reply(
      m,
      `_❌ Terjadi kesalahan saat memproses perintah. Silakan coba lagi nanti._`
    );
  }
}

export default {
  handle,
  Commands: ["cleandb"],
  OnlyPremium: false,
  OnlyOwner: true,
};
