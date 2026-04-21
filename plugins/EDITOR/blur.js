import fs from "fs";
import sharp from "sharp";
import mess from "../../strings.js";
import { downloadQuotedMedia, downloadMedia } from "../../lib/utils.js";

async function validateMediaType(
  sock,
  remoteJid,
  message,
  mediaType,
  prefix,
  command
) {
  if (mediaType !== "imageMessage") {
    await sock.sendMessage(
      remoteJid,
      { text: `⚠️ _Kirim/Balas gambar dengan caption *${prefix + command}*_` },
      { quoted: message }
    );
    return false;
  }
  return true;
}

async function validateBlurLevel(content, sock, remoteJid, message) {
  const blurLevel = parseFloat(content);

  // Validate blur level between 1 and 100
  if (isNaN(blurLevel) || blurLevel < 1 || blurLevel > 100) {
    await sock.sendMessage(
      remoteJid,
      { text: "⚠️ _Masukkan nilai blur antara 1 - 100_" },
      { quoted: message }
    );
    return false;
  }

  // Normalize the blur value to sharp's expected range
  const sigma = (blurLevel / 100) * 9.9 + 0.1;
  return sigma;
}

async function processImage(mediaPath, sigma) {
  const outputImagePath = `tmp/tmp_blurred_${Date.now()}.jpg`;
  await sharp(mediaPath).blur(sigma).toFile(outputImagePath);
  return outputImagePath;
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, isQuoted, type, prefix, command } =
    messageInfo;

  const mediaType = isQuoted ? `${isQuoted.type}Message` : `${type}Message`;

  // Validate media type
  if (
    !(await validateMediaType(
      sock,
      remoteJid,
      message,
      mediaType,
      prefix,
      command
    ))
  )
    return;

  // Validate and normalize blur level
  const sigma = await validateBlurLevel(content, sock, remoteJid, message);
  if (!sigma) return;

  try {
    // Download media
    const media = isQuoted
      ? await downloadQuotedMedia(message)
      : await downloadMedia(message);
    const mediaPath = `tmp/${media}`;

    // Ensure the file exists
    if (!fs.existsSync(mediaPath)) {
      await sock.sendMessage(
        remoteJid,
        { text: "⚠️ _File gambar tidak ditemukan._" },
        { quoted: message }
      );
      return;
    }

    // Show "Loading" reaction
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Process the image with blur
    const outputImagePath = await processImage(mediaPath, sigma);

    // Ensure the processed file exists and send it
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
      throw new Error("File hasil blur tidak ditemukan.");
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
  Commands: ["blur"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
