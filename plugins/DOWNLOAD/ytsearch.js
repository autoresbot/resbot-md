// const yts = require("yt-search");
import yts from "yt-search";

import { logCustom } from "../../lib/logger.js";

// Fungsi untuk mengirim pesan dengan kutipan (quote)
async function sendMessageWithQuote(sock, remoteJid, message, text) {
  await sock.sendMessage(remoteJid, { text }, { quoted: message });
}

// Fungsi untuk menangani pencarian YouTube
async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;

  try {
    // Validasi input
    if (!content.trim() || content.trim() == "") {
      return sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
          prefix + command
        } matahariku*_`
      );
    }

    // Tampilkan reaksi "Loading"
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Melakukan pencarian menggunakan yts
    const search = await yts(content);

    // Menyusun teks hasil pencarian
    let teks = `*YouTube Search*\n\nResult for: _${content}_\n\n`;
    let no = 1;

    for (let video of search.all) {
      teks +=
        `⭔ No: ${no++}\n` +
        `⭔ Type: ${video.type}\n` +
        `⭔ Video ID: ${video.videoId}\n` +
        `⭔ Title: ${video.title}\n` +
        `⭔ Views: ${video.views}\n` +
        `⭔ Duration: ${video.timestamp}\n` +
        `⭔ Upload At: ${video.ago}\n` +
        `⭔ URL: ${video.url}\n\n` +
        `─────────────────\n\n`;
    }

    // Mengirim hasil pencarian
    await sock.sendMessage(
      remoteJid,
      {
        image: { url: search.all[0].thumbnail },
        caption: teks,
      },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error while searching YouTube:", error);
    logCustom("info", content, `ERROR-COMMAND-${command}.txt`);

    // Menangani kesalahan dan mengirim pesan ke pengguna
    const errorMessage = `Maaf, terjadi kesalahan saat memproses permintaan Anda. Mohon coba lagi nanti.\n\nDetail Error: ${
      error.message || error
    }`;
    await sendMessageWithQuote(sock, remoteJid, message, errorMessage);
  }
}

export default {
  handle,
  Commands: ["yts", "ytsearch"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
