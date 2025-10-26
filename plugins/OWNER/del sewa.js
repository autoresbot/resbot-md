import { deleteSewa } from "../../lib/sewa.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;

  // Validasi input
  if (!content || !content.trim()) {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `_⚠️ Format Penggunaan:_\n\n_💬 Contoh:_ _*${
          prefix + command
        } 123xxxxx@g.us*_\n\n_Untuk mendapatkan ID grup, silakan ketik *.listsewa*_`,
      },
      { quoted: message }
    );
  }

  // Validasi format ID grup
  if (!content.includes("@g.us")) {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `_⚠️ Format tidak valid!_\n\n_Pastikan ID grup mengandung '@g.us'._\n\n_💬 Contoh penggunaan:_ _*${
          prefix + command
        } 123xxxxx@g.us*_`,
      },
      { quoted: message }
    );
  }

  try {
    // Hapus data sewa berdasarkan ID grup
    const result = await deleteSewa(content.trim());

    if (result) {
      // Pesan berhasil
      return await sock.sendMessage(
        remoteJid,
        {
          text: `✅ _Berhasil menghapus data sewa untuk ID grup:_ *${content}*`,
        },
        { quoted: message }
      );
    } else {
      // Pesan jika ID tidak ditemukan
      return await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ _ID grup tidak ditemukan:_ *${content}*\n\n_Pastikan ID grup benar atau tersedia di daftar sewa._`,
        },
        { quoted: message }
      );
    }
  } catch (error) {
    console.error("Gagal menghapus ID grup:", error);

    // Pesan error
    return await sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ _Terjadi kesalahan saat menghapus data sewa._\n\n_Error:_ ${error.message}`,
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["delsewa"],
  OnlyPremium: false,
  OnlyOwner: true,
};
