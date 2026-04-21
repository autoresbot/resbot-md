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

    const outputImagePath = `tmp/tmp_${Date.now()}.jpg`;

    await sharp(mediaPath)
      .modulate({ brightness: 1.5, saturation: 0.5 })
      .tint({ r: 112, g: 66, b: 20 })
      .toFile(outputImagePath);

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
      throw new Error("File hasil sepia tidak ditemukan.");
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
  Commands: ["duotone"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
