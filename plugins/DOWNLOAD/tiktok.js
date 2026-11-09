
import { logCustom } from "../../lib/logger.js";
import { downloadToBuffer } from "../../lib/utils.js";
import { resolveTiktokUrl } from "../../lib/scrape/tiktok.js";

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
 * Bungkus sebuah promise dengan batas waktu. Dulu `.tt` bisa "menggantung"
 * tanpa akhir kalau resolve URL / API / download tidak pernah merespons
 * (tidak ada timeout), sehingga user tidak pernah dapat pesan error.
 */
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Timeout: ${label} tidak merespons dalam ${ms / 1000}s`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Fungsi utama untuk menangani perintah TikTok
 * @param {object} sock - Instance koneksi WhatsApp
 * @param {object} messageInfo - Informasi pesan yang diterima
 */
async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;

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

    // Validasi URL TikTok (link pendek vm.tiktok.com dll diikuti
    // redirect-nya dulu, karena API hanya menerima link www.tiktok.com)
    if (!/tiktok\.com/i.test(content)) {
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

    const validLink = await withTimeout(
      resolveTiktokUrl(content),
      15000,
      "resolve URL TikTok",
    );

      const api = new ApiAutoresbot(config.APIKEY);

    // Memanggil API untuk mendapatkan data video TikTok
     const response = await withTimeout(
        api.get('/api/downloader/tiktok', { url: validLink }),
        30000,
        "API TikTok",
      );

      if (!response || response.code !== 200 || !response.data) {
        throw new Error('Server TikTok tidak mengembalikan data valid');
      }

    // Download file ke buffer
    const audioBuffer = await withTimeout(
      downloadToBuffer(response.data.url, "mp4"),
      60000,
      "download video TikTok",
    );

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
