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
    react: {
      text: reaction,
      key: message.key,
    },
  });
}

// Fungsi pencarian YouTube
async function searchYouTube(query) {
  const searchResults = await yts(query);

  return (
    searchResults.all.find((item) => item.type === 'video') ||
    searchResults.all[0]
  );
}

// Fungsi delay
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fungsi memanggil API dengan retry
async function fetchWithRetry(
  api,
  endpoint,
  params,
  maxRetries = 6,
  delayMs = 7000,
) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await api.get(endpoint, params);

      const mediaUrl =
        response?.data?.url ||
        response?.data?.result?.url ||
        response?.data?.data?.url;

      if (response?.status && mediaUrl) {
        return {
          ...response,
          data: {
            ...response.data,
            url: mediaUrl,
          },
        };
      }

      throw new Error(
        `Response API tidak valid pada percobaan ke-${attempt}`,
      );
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        await delay(delayMs);
      }
    }
  }

  throw lastError;
}

// Fungsi utama
async function handle(sock, messageInfo) {
  const {
    remoteJid,
    message,
    content,
    prefix,
    command,
  } = messageInfo;

  try {
    const query = content?.trim();

    if (!query) {
      return sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        `_⚠️ Format Penggunaan:_\n\n_💬 Contoh:_ _*${prefix + command} matahariku*_`,
      );
    }

    await sendReaction(sock, message, '⏰');

    // =========================
    // PENCARIAN YOUTUBE
    // =========================
    const video = await searchYouTube(query);

    if (!video || !video.url) {
      await sendReaction(sock, message, '❗');

      return sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        '⛔ _Tidak dapat menemukan video yang sesuai._',
      );
    }

    // Batas maksimal 1 jam
    if (video.seconds && video.seconds > 3600) {
      await sendReaction(sock, message, '❗');

      return sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        '_Maaf, durasi video terlalu panjang. Maksimal durasi adalah 1 jam._',
      );
    }

    // =========================
    // CAPTION
    // =========================
    const description = video.description
      ? video.description.slice(0, 1000)
      : '-';

    const caption = `*YOUTUBE DOWNLOADER*

◧ *Title:* ${video.title}
◧ *Duration:* ${video.timestamp || '-'}
◧ *Uploaded:* ${video.ago || '-'}
◧ *Views:* ${video.views || '-'}

◧ *Description:*
${description}`;

    // =========================
    // REQUEST API DOWNLOADER
    // =========================
    const api = new ApiAutoresbot(config.APIKEY);

    const response = await fetchWithRetry(
      api,
      '/api/downloader/ytmp4',
      {
        url: video.url,
      },
      14,
      9000,
    );

    const urlMedia = response?.data?.url;

    if (!urlMedia) {
      throw new Error('URL video dari API tidak ditemukan.');
    }

    // =========================
    // DOWNLOAD VIDEO KE BUFFER
    // =========================
    const videoBuffer = await downloadToBuffer(urlMedia, 'mp4');

    if (!videoBuffer || videoBuffer.length === 0) {
      throw new Error('Gagal mendownload file video.');
    }

    // =========================
    // KIRIM VIDEO
    // =========================
    await sock.sendMessage(
      remoteJid,
      {
        video: videoBuffer,
        mimetype: 'video/mp4',
        caption,
      },
      {
        quoted: message,
      },
    );

    await sendReaction(sock, message, '✅');
  } catch (error) {
    console.error('Error while handling command:', error);

    logCustom(
      'info',
      content,
      `ERROR-COMMAND-${command}.txt`,
    );

    const errorMessage = `⚠️ Maaf, terjadi kesalahan saat memproses permintaan Anda. Mohon coba lagi nanti.

💡 Detail: ${error.message || error}`;

    await sendReaction(sock, message, '❗');

    await sendMessageWithQuote(
      sock,
      remoteJid,
      message,
      errorMessage,
    );
  }
}

export default {
  handle,
  Commands: ['playvid'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};

