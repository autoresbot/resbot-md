import yts from 'yt-search';
import ApiAutoresbotModule from 'api-autoresbot';
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from '../../config.js';
import { logCustom } from '../../lib/logger.js';
import { downloadToBuffer } from '../../lib/utils.js';

// Fungsi kirim pesan dengan quote
async function sendMessageWithQuote(sock, remoteJid, message, text) {
  return sock.sendMessage(remoteJid, { text }, { quoted: message });
}

// Fungsi kirim reaksi
async function sendReaction(sock, message, reaction) {
  return sock.sendMessage(message.key.remoteJid, {
    react: { text: reaction, key: message.key },
  });
}

// Fungsi pencarian YouTube
async function searchYouTube(query) {
  const searchResults = await yts(query);
  return searchResults.all.find((item) => item.type === 'video') || searchResults.all[0];
}

// Fungsi delay (jeda)
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fungsi untuk memanggil API dengan retry (maksimal 3x, jeda 5 detik)
async function fetchWithRetry(api, endpoint, params, maxRetries = 6, delayMs = 7000) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await api.get(endpoint, params);
      if (response && response.status && response.data.url) {
        //console.log(`✅ API berhasil pada percobaan ke-${attempt}`);
        return response;
      }
      throw new Error(`Response tidak valid (percobaan ${attempt})`);
    } catch (err) {
      lastError = err;
      //console.warn(`❌ Percobaan ke-${attempt} gagal: ${err.message}`);
      if (attempt < maxRetries) {
        // console.log(`⏳ Menunggu ${delayMs / 1000} detik sebelum mencoba lagi...`);
        await delay(delayMs);
      }
    }
  }
  throw lastError;
}

// Fungsi utama
async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;

  try {
    const query = content.trim();
    if (!query) {
      return sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${prefix + command} matahariku*_`,
      );
    }

    await sendReaction(sock, message, '⏰');

    // Pencarian YouTube
    const video = await searchYouTube(query);

    if (!video || !video.url) {
      return sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        '⛔ _Tidak dapat menemukan video yang sesuai_',
      );
    }

    if (video.seconds > 3600) {
      return sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        '_Maaf, video terlalu besar untuk dikirim melalui WhatsApp._',
      );
    }

    const caption = `*YOUTUBE DOWNLOADER*\n\n◧ Title: ${video.title}\n◧ Duration: ${video.timestamp}\n◧ Uploaded: ${video.ago}\n◧ Views: ${video.views}\n◧ Description: ${video.description}`;

    // Inisialisasi API dan gunakan fetchWithRetry
    const api = new ApiAutoresbot(config.APIKEY);
    const response = await fetchWithRetry(
      api,
      '/api/downloader/ytplay',
      { url: video.url, format: 'm4a' },
      7,
      9000,
    );

    if (response && response.status) {
      const url_media = response.data.url;

      // Kirim image dengan caption
      await sock.sendMessage(
        remoteJid,
        { image: { url: video.thumbnail }, caption },
        { quoted: message },
      );

      // Download file audio ke buffer
      const audioBuffer = await downloadToBuffer(url_media, 'mp3');

      await sock.sendMessage(
        remoteJid,
        {
          audio: audioBuffer,
          fileName: `yt.mp3`,
          mimetype: 'audio/mp4',
        },
        { quoted: message },
      );
    } else {
      await sendReaction(sock, message, '❗');
    }
  } catch (error) {
    console.error('Error while handling command:', error);
    logCustom('info', content, `ERROR-COMMAND-${command}.txt`);

    const errorMessage = `⚠️ Maaf, terjadi kesalahan saat memproses permintaan Anda. Mohon coba lagi nanti.\n\n💡 Detail: ${
      error.message || error
    }`;
    await sendMessageWithQuote(sock, remoteJid, message, errorMessage);
  }
}

export default {
  handle,
  Commands: ['play'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
