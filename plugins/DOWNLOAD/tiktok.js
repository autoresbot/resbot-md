
import { logCustom } from "../../lib/logger.js";
import { extractLink, downloadToBuffer } from "../../lib/utils.js";

import ApiAutoresbotModule from 'api-autoresbot';
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;
import config from '../../config.js';
/**
 * Mengirim pesan dengan kutipan (quoted message)
 * @param {object} sock - Instance koneksi WhatsApp
 * @param {string} remoteJid - ID pengirim pesan
 * @param {object} message - Pesan yang dikutip
 * @param {string} text - Teks pesan yang akan dikirim
 */
async function sendMessageWithQuote(sock, remoteJid, message, text) {
  await sock.sendMessage(remoteJid, { text }, { quoted: message });
}

/**
 * Memvalidasi apakah URL yang diberikan adalah URL TikTok yang valid
 * @param {string} url - URL yang akan divalidasi
 * @returns {boolean} True jika valid, false jika tidak
 */
function isTikTokUrl(url) {
  return /tiktok\.com/i.test(url);
}

/**
 * Fungsi utama untuk menangani perintah TikTok
 * @param {object} sock - Instance koneksi WhatsApp
 * @param {object} messageInfo - Informasi pesan yang diterima
 */
async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;

  const validLink = extractLink(content);

  try {
    // Validasi input: pastikan konten ada
    if (!content.trim() || content.trim() == "") {
      return sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
          prefix + command
        } linknya*_`
      );
    }

    // Validasi URL TikTok
    if (!isTikTokUrl(validLink)) {
      return sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        "URL yang Anda masukkan tidak valid. Pastikan URL berasal dari TikTok."
      );
    }

    // Tampilkan reaksi "Loading"
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });
      const api = new ApiAutoresbot(config.APIKEY);

    // Memanggil API untuk mendapatkan data video TikTok
     const response = await api.get('/api/downloader/tiktok', {
        url: content,
      });

      if (!response || response.code !== 200 || !response.data) {
        throw new Error('Fallback tidak mengembalikan data valid');
      }

    // Download file ke buffer
    const audioBuffer = await downloadToBuffer(response.data.url, "mp4");

    // Mengirim video tanpa watermark dan caption
    await sock.sendMessage(
      remoteJid,
      {
        video: audioBuffer,
        caption: response.data.title,
      },
      { quoted: message }
    );
  } catch (error) {
    console.error("Kesalahan saat memproses perintah TikTok:", error);
    logCustom("info", content, `ERROR-COMMAND-${command}.txt`);

    // Kirim pesan kesalahan yang lebih informatif
    const errorMessage = `Maaf, terjadi kesalahan saat memproses permintaan Anda. Mohon coba lagi nanti.\n\n*Detail Kesalahan:* ${
      error.message || error
    }`;
    await sendMessageWithQuote(sock, remoteJid, message, errorMessage);
  }
}

export default {
  handle,
  Commands: ["tt", "tiktok"], // Menentukan perintah yang diproses oleh handler ini
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
