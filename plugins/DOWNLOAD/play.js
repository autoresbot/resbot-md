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
    react: { text: reaction, key: message.key },
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
      await sendReaction(sock, message, '❗');
      return sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        '⛔ _Tidak dapat menemukan video yang sesuai_',
      );
    }

    if (video.seconds > 3600) {
      await sendReaction(sock, message, '❗');
      return sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        '_Maaf, video terlalu besar untuk dikirim melalui WhatsApp._',
      );
    }

    const caption = `*YOUTUBE DOWNLOADER*\n\n◧ Title: ${video.title}\n◧ Duration: ${video.timestamp}\n◧ Uploaded: ${video.ago}\n◧ Views: ${video.views}\n◧ Description: ${video.description}`;

    // Link media dicari lewat helper bersama: link diambil dari bentuk response
    // apa pun, kegagalan yang percuma diulang langsung dihentikan, sisanya
    // diulang dengan jeda bertingkat. Lihat lib/ytdownloader.js.
    const api = new ApiAutoresbot(config.APIKEY);
    const { url: url_media } = await ambilMediaDenganRetry(
      api,
      '/api/downloader/ytplay',
      { url: video.url, format: 'm4a' },
      { label: `play "${query}"` },
    );

    // Kirim image dengan caption
    await sock.sendMessage(
      remoteJid,
      { image: { url: video.thumbnail }, caption },
      { quoted: message },
    );

    // Download file audio ke buffer
    const audioBuffer = await downloadToBuffer(url_media, 'mp3');

    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('File audio gagal diunduh dari server downloader.');
    }

    await sock.sendMessage(
      remoteJid,
      {
        audio: audioBuffer,
        fileName: `yt.mp3`,
        mimetype: 'audio/mp4',
      },
      { quoted: message },
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
      pesanGagal('audio', error, `${prefix}${command} ${content.trim()}`),
    );
  }
}

export default {
  handle,
  Commands: ['play'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
