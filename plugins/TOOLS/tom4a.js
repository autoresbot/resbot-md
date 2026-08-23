import fs from "fs";
import path from "path";
import {
  downloadQuotedMedia,
  downloadMedia,
  reply,
  convertAudioToCompatibleFormat,
} from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, isQuoted, prefix, command, type } = messageInfo;

  try {
    const mediaType = isQuoted ? isQuoted.type : type;
    if (mediaType !== "audio") {
      return await reply(
        m,
        `⚠️ _Balas Audio dengan caption *${prefix + command}*_`
      );
    }

    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Download & Upload media
    const media = isQuoted
      ? await downloadQuotedMedia(message)
      : await downloadMedia(message);

    if (!media) {
      throw new Error("Gagal mengunduh media.");
    }

    const mediaPath = path.join("tmp", media);
    const baseDir = process.cwd(); // Menggunakan direktori kerja saat ini
    const inputPath = path.join(baseDir, mediaPath); // File asli

    // Pastikan folder tmp ada
    if (!fs.existsSync(path.join(baseDir, "tmp"))) {
      fs.mkdirSync(path.join(baseDir, "tmp"), { recursive: true });
    }

    if (!fs.existsSync(inputPath)) {
      throw new Error("File media tidak ditemukan setelah diunduh.");
    }

    const output = await convertAudioToCompatibleFormat(inputPath);

    await sock.sendMessage(
      remoteJid,
      {
        audio: { url: output },
        mimetype: "audio/mp4", // Tetap gunakan audio/mp4 untuk M4A
      },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error saat mengirim audio:", error);

    const errorMessage = `Maaf, terjadi kesalahan saat memproses permintaan Anda. Mohon coba lagi nanti.\n\nDetail Error: ${
      error.message || error
    }`;
    await sendMessageWithQuote(sock, remoteJid, message, errorMessage);
  }
}

async function sendMessageWithQuote(sock, remoteJid, message, text) {
  await sock.sendMessage(remoteJid, { text }, { quoted: message });
}

export default {
  handle,
  Commands: ["tom4a"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
