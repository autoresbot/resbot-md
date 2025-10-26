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

  // Validasi input ketajaman
  const sharpnessLevel = parseFloat(content);
  if (isNaN(sharpnessLevel) || sharpnessLevel < 1 || sharpnessLevel > 100) {
    await sock.sendMessage(
      remoteJid,
      { text: "⚠️ _Masukkan nilai ketajaman antara 1 - 100_" },
      { quoted: message }
    );
    return;
  }

  // Normalisasi nilai sharpnessLevel ke rentang 0.1 - 10
  const sigma = (sharpnessLevel / 100) * 9.9 + 0.1;

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
        { text: "_File gambar tidak ditemukan._" },
        { quoted: message }
      );
      return;
    }

    // Tampilkan reaksi "Loading"
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const outputImagePath = `tmp/tmp_sharpen_${Date.now()}.jpg`;

    await sharp(mediaPath).sharpen({ sigma }).toFile(outputImagePath);

    // Pastikan file hasil ada dan valid
    if (fs.existsSync(outputImagePath)) {
      await sock.sendMessage(
        remoteJid,
        {
          image: { url: outputImagePath },
          caption: mess.general.success,
        },
        { quoted: message }
      );
    } else {
      throw new Error("File hasil mempertajam tidak ditemukan.");
    }
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
  Commands: ["tajam"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
