import { getGroupMetadata } from "../../lib/cache.js";
import { deleteBadword } from "../../lib/badword.js";
import { deleteGroup } from "../../lib/group.js";
import { deleteAllListInGroup } from "../../lib/list.js";
import { deleteAbsen } from "../../lib/absen.js";
import { resetTotalChatPerGroup } from "../../lib/totalchat.js";
import { addSlr } from "../../lib/slr.js";
import { getDb } from "../../lib/database.js";
import mess from "../../strings.js";

// Fungsi untuk memeriksa apakah pengirim adalah admin grup
async function isAdmin(sock, remoteJid, sender) {
  try {
    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    const participants = groupMetadata.participants;
    return participants.some(
      (p) => (p.phoneNumber === sender || p.id === sender) && p.admin
    );
  } catch (error) {
    return false;
  }
}

// Fungsi utama untuk mereset grup
async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender } = messageInfo;

  // Pastikan hanya grup yang dapat menjalankan fitur ini
  if (!isGroup) return;

  try {
    // Periksa apakah pengirim adalah admin grup
    const adminStatus = await isAdmin(sock, remoteJid, sender);
    if (!adminStatus) {
      await sock.sendMessage(
        remoteJid,
        { text: mess.general.isAdmin },
        { quoted: message }
      );
      return;
    }

    // Lakukan reset grup untuk remoteJid tertentu
    await resetGroupSettings(remoteJid);

    // Kirim pesan konfirmasi setelah reset berhasil
    await sock.sendMessage(
      remoteJid,
      { text: "Pengaturan grup ini telah berhasil direset." },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error in resetgc command:", error);

    // Kirim pesan kesalahan jika terjadi error
    await sock.sendMessage(
      remoteJid,
      { text: "⚠️ Terjadi kesalahan saat mereset pengaturan grup." },
      { quoted: message }
    );
  }
}

// Fungsi untuk mereset pengaturan grup berdasarkan remoteJid (menggunakan SQLite)
async function resetGroupSettings(remoteJid) {
  try {
    // Reset absen untuk grup ini
    await deleteAbsen(remoteJid);

    // Reset participant data untuk grup ini
    try {
      const db = getDb();
      db.prepare('DELETE FROM participants WHERE id = ?').run(remoteJid);
    } catch (e) {
      // Abaikan jika tidak ada data
    }

    // Reset totalchat untuk grup ini
    await resetTotalChatPerGroup(remoteJid);

    // Reset badword untuk grup ini
    await deleteBadword(remoteJid);

    // Reset SLR untuk grup ini
    try {
      const db = getDb();
      db.prepare('DELETE FROM slr WHERE id = ?').run(remoteJid);
    } catch (e) {
      // Abaikan jika tidak ada data
    }

    // Reset list untuk grup ini
    await deleteAllListInGroup(remoteJid);

    // Reset group settings
    await deleteGroup(remoteJid);
  } catch (error) {
    throw new Error("Gagal mereset pengaturan grup.");
  }
}

export default {
  handle,
  Commands: ["resetgc"],
  OnlyPremium: false,
  OnlyOwner: false,
};
