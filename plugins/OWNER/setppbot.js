import { downloadQuotedMedia, downloadMedia } from "../../lib/utils.js";
import config from "../../config.js";
import path from "path";

// Direktori root proyek
const rootDir = process.cwd();

async function handle(sock, messageInfo) {
  const { remoteJid, message, type, isQuoted, prefix, command } = messageInfo;

  try {
    // Unduh media (gambar) dan tentukan tipe media
    const media = isQuoted
      ? await downloadQuotedMedia(message)
      : await downloadMedia(message);
    const mediaType = isQuoted ? `${isQuoted.type}Message` : `${type}Message`;

    if (media && mediaType === "imageMessage") {
      const botJid = `${config.phone_number_bot}@s.whatsapp.net`;
      // Path lengkap ke folder tmp
      const mediaPath = path.join(rootDir, "tmp", media);

      await sock.updateProfilePicture(botJid, { url: mediaPath });

      return await sock.sendMessage(
        remoteJid,
        { text: `_Berhasil, Foto Profil Bot Telah Di Ganti_` },
        { quoted: message }
      );
    }

    // Jika media tidak valid, kirim instruksi
    return await sock.sendMessage(
      remoteJid,
      { text: `⚠️ _Kirim/Balas gambar dengan caption *${prefix + command}*_` },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error processing message:", error);

    // Kirim pesan error
    await sock.sendMessage(remoteJid, {
      text: "Terjadi kesalahan saat memproses pesan.",
    });
  }
}

export default {
  handle,
  Commands: ["setppbot"],
  OnlyPremium: false,
  OnlyOwner: true,
};
