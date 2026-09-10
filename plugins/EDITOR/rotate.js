import fs from "fs";
import sharp from "sharp";
import mess from "../../strings.js";
import { downloadQuotedMedia, downloadMedia } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, isQuoted, type, prefix, command } =
    messageInfo;

  // Tentukan tipe media
  const mediaType = isQuoted ? `${isQuoted.type}Message` : `${type}Message`;

  // Validasi tipe media
  if (mediaType !== "imageMessage") {
    await sock.sendMessage(
      remoteJid,
      { text: `⚠️ _Kirim/Balas gambar dengan caption *${prefix + command}*_` },
      { quoted: message }
    );
    return;
  }

  // Validasi input rotasi
  const rotationAngle = parseInt(content, 10);
  if (isNaN(rotationAngle) || rotationAngle < 1 || rotationAngle > 360) {
    await sock.sendMessage(
      remoteJid,
      { text: "⚠️ _Masukkan Rotate 1 - 360_" },
      { quoted: message }
    );
    return;
  }

  try {
    // Unduh media
    const media = isQuoted
      ? await downloadQuotedMedia(message)
      : await downloadMedia(message);
    const mediaPath = `tmp/${media}`;

    // Pastikan file ada sebelum diproses
    if (!fs.existsSync(mediaPath)) {
      await sock.sendMessage(
        remoteJid,
        { text: "⚠️ _File gambar tidak ditemukan._" },
        { quoted: message }
      );
      return;
    }

    // Tampilkan reaksi "Loading"
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const outputImagePath = `tmp/tmp_rotate_${Date.now()}.jpg`;
    await sharp(mediaPath).rotate(rotationAngle).toFile(outputImagePath);
    await sock.sendMessage(
      remoteJid,
      {
        image: { url: outputImagePath },
        caption: mess.general.success,
      },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error saat memproses gambar:", error);
    await sock.sendMessage(
      remoteJid,
      { text: "_Terjadi kesalahan saat memproses gambar._" },
      { quoted: message }
    );
  }
}
export default {
  handle,
  Commands: ["rotate"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
