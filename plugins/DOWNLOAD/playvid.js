import yts from 'yt-search';
import ApiAutoresbotModule from 'api-autoresbot';
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from '../../config.js';
import { logCustom } from '../../lib/logger.js';
import { downloadToBuffer } from '../../lib/utils.js';
import { ambilMediaDenganRetry, pesanGagal } from '../../lib/ytdownloader.js';

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

  return searchResults.all.find((item) => item.type === 'video') || searchResults.all[0];
}

// Fungsi utama
async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;

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
    const description = video.description ? video.description.slice(0, 1000) : '-';

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
    // Retry & pembacaan link ditangani helper bersama (lib/ytdownloader.js),
    // jadi keempat plugin downloader berperilaku sama.
    const api = new ApiAutoresbot(config.APIKEY);

    const { url: urlMedia } = await ambilMediaDenganRetry(
      api,
      '/api/downloader/ytmp4',
      { url: video.url },
      { label: `playvid "${query}"` },
    );

    // =========================
    // DOWNLOAD VIDEO KE BUFFER
    // =========================
    const videoBuffer = await downloadToBuffer(urlMedia, 'mp4');

    if (!videoBuffer || videoBuffer.length === 0) {
      throw new Error('File video gagal diunduh dari server downloader.');
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

    logCustom('info', `${content} :: ${error?.message || error}`, `ERROR-COMMAND-${command}.txt`);

    await sendReaction(sock, message, '❗').catch(() => {});

    await sendMessageWithQuote(
      sock,
      remoteJid,
      message,
      pesanGagal('video', error, `${prefix}${command} ${(content || '').trim()}`),
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
