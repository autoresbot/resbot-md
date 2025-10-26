// const { igdl } = require("btch-downloader");
import { igdl } from "btch-downloader";

import mess from "../../strings.js";
import { logCustom } from "../../lib/logger.js";
import { downloadToBuffer } from "../../lib/utils.js";
/**
 * Mengirim pesan dengan kutipan
 * @param {object} sock - Objek koneksi WebSocket
 * @param {string} remoteJid - ID pengguna tujuan
 * @param {object} message - Pesan asli yang dikutip
 * @param {string} text - Pesan teks yang dikirim
 */
async function sendMessageWithQuote(sock, remoteJid, message, text) {
  await sock.sendMessage(remoteJid, { text }, { quoted: message });
}

/**
 * Memvalidasi apakah URL yang diberikan adalah URL Instagram yang valid
 * @param {string} url - URL yang akan divalidasi
 * @returns {boolean} True jika valid, false jika tidak
 */
function isIGUrl(url) {
  return /instagram\.com/i.test(url);
}

/**
 * Fungsi utama untuk menangani permintaan unduhan media Instagram
 * @param {object} sock - Objek koneksi WebSocket
 * @param {object} messageInfo - Informasi pesan termasuk konten dan pengirim
 */
async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;

  try {
    // Validasi input: pastikan konten ada dan URL valid
    if (!content?.trim() || !isIGUrl(content)) {
      return sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
          prefix + command
        } https://www.instagram.com/xxx*_`
      );
    }

    // Tampilkan reaksi "Loading"
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Panggil API igdl untuk mendapatkan media
    const response = await igdl(content);

    if (!response || response.length === 0) {
      throw new Error("Tidak ada media yang ditemukan pada URL tersebut.");
    }

    // Buat Set untuk filter URL unik
    const seen = new Set();

    // Ambil hanya gambar unik, maksimal 4
    const uniqueImages = response
      .filter((media) => {
        if (!media.url || seen.has(media.url)) return false;
        seen.add(media.url);
        return true;
      })
      .slice(0, 4);

    // Loop kirim hanya 4 gambar unik
    for (const media of uniqueImages) {
      const urlMedia = media.url;
      const buffer = await downloadToBuffer(urlMedia, "jpg"); // anggap image

      await sock.sendMessage(remoteJid, {
        image: buffer,
        caption: mess.general.success,
      });
    }
  } catch (error) {
    console.error("Kesalahan saat memproses Instagram:", error);
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
  Commands: ["igfoto", "instagramfoto"], // Perintah yang didukung oleh handler ini
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
