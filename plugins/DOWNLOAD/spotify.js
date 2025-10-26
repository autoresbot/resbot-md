import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";

import { logCustom } from "../../lib/logger.js";

async function sendMessageWithQuote(sock, remoteJid, message, text) {
  await sock.sendMessage(remoteJid, { text }, { quoted: message });
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;

  try {
    // Validasi input
    const query = content.trim();
    if (!query) {
      return sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        `_⚠️ Format Penggunaan:_\n\n_💬 Contoh:_ _*${
          prefix + command
        } matahariku*_`
      );
    }

    // Tampilkan reaksi "Loading"
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Inisialisasi API
    const api = new ApiAutoresbot(config.APIKEY);

    // Memanggil API dengan parameter
    const response = await api.get("/api/search/spotify", { text: query });

    // Menangani respons API
    const results = response?.data;
    if (Array.isArray(results) && results.length > 0) {
      let reply = `🔍 *Hasil Pencarian Spotify untuk "${query}":*\n\n`;
      results.forEach((item, index) => {
        const { title, artist, url, duration, popularity, preview } = item;

        reply += `*${index + 1}. ${title}*\n`;
        reply += `   🎤 *Artist:* ${artist}\n`;
        reply += `   ⏱️ *Durasi:* ${(duration / 1000).toFixed(0)} detik\n`;
        reply += `   🌟 *Popularitas:* ${popularity}\n`;
        reply += `   🔗 ${url}\n`;
        if (preview) {
          reply += `   🎵 ${preview}\n`;
        }
        reply += `\n`;
      });

      // Kirim hasil pencarian
      await sendMessageWithQuote(sock, remoteJid, message, reply.trim());
    } else {
      // Pesan jika data kosong
      await sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        "⚠️ Maaf, tidak ada hasil yang ditemukan untuk pencarian Anda."
      );
    }
  } catch (error) {
    logCustom("info", content, `ERROR-COMMAND-${command}.txt`);

    // Menangani error
    await sock.sendMessage(
      remoteJid,
      {
        text: `❌ Maaf, terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.\n\n*Error:* ${error.message}`,
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["spotify"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
