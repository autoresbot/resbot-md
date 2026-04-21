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

async function validateSizeInput(content, sock, remoteJid, message) {
  const [width, height] = content.split(" ").map(Number);

  // Check for invalid or missing input
  if (isNaN(width) || isNaN(height) || width < 1 || height < 1) {
    await sock.sendMessage(
      remoteJid,
      { text: "⚠️ _Masukkan ukuran yang valid. Contoh: .resize 100 200_" },
      { quoted: message }
    );
    return false;
  }

  return { width, height };
}

async function processImage(mediaPath, width, height) {
  const outputImagePath = `tmp/tmp_resize_${Date.now()}.jpg`;
  await sharp(mediaPath).resize({ width, height }).toFile(outputImagePath);
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

  // Validate and extract resize dimensions
  const size = await validateSizeInput(content, sock, remoteJid, message);
  if (!size) return;
  const { width, height } = size;

  try {
    // Download media
    const media = isQuoted
      ? await downloadQuotedMedia(message)
      : await downloadMedia(message);
    const mediaPath = `tmp/${media}`;

    // Check if the file exists before processing
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

    // Process the image
    const outputImagePath = await processImage(mediaPath, width, height);

    // Send the processed image back
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
  Commands: ["resize"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
