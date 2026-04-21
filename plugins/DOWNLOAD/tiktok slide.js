const limit = 4; // jumlah gambar yang di kirim

import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";

import { extractLink } from "../../lib/utils.js";
import { logCustom } from "../../lib/logger.js";

function isTikTokUrl(url) {
  return /tiktok\.com/i.test(url);
}

async function sendMessageWithQuote(sock, remoteJid, message, text) {
  await sock.sendMessage(remoteJid, { text }, { quoted: message });
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;

  try {
    const validLink = extractLink(content);

    // Validasi input
    if (!content?.trim() || !isTikTokUrl(content)) {
      return sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
          prefix + command
        } https://vt.tiktok.com/ZSjqUj8cc/*_`
      );
    }

    // Tampilkan reaksi "Loading"
    await sock.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    // Inisialisasi API dengan APIKEY dari config
    const api = new ApiAutoresbot(config.APIKEY);

    // Memanggil API untuk mengunduh audio
    const response = await api.get("/api/downloader/tiktok-slide", {
      url: validLink,
    });

    // Validasi respons
    if (!response || !response.data || response.data.length === 0) {
      throw new Error("Tidak ada gambar yang ditemukan pada URL tersebut.");
    }

    // Kirim gambar sesuai limit
    const imagesToSend = response.data.slice(0, limit);
    for (const imageUrl of imagesToSend) {
      await sock.sendMessage(remoteJid, {
        image: { url: imageUrl },
        caption: ``,
      });
    }
  } catch (error) {
    console.error("Kesalahan saat memproses perintah TikTok:", error);
    logCustom("info", content, `ERROR-COMMAND-${command}.txt`);

    // Kirim pesan kesalahan yang lebih deskriptif
    const errorMessage = `Maaf, terjadi kesalahan saat memproses permintaan Anda. Mohon coba lagi nanti.\n\n*Detail Kesalahan:* ${
      error.message || "Kesalahan tidak diketahui"
    }`;
    await sendMessageWithQuote(sock, remoteJid, message, errorMessage);
  }
}

export default {
  handle,
  Commands: ["ttslide", "tiktokslide"], // Perintah yang didukung
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
