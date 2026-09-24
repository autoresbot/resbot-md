import ApiAutoresbotModule from 'api-autoresbot';
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from '../../config.js';
import { logCustom } from '../../lib/logger.js';
import { extractLink, downloadToBuffer } from '../../lib/utils.js';
import { ambilMediaDenganRetry, pesanGagal } from '../../lib/ytdownloader.js';

// Fungsi kirim pesan dengan quote
async function sendMessageWithQuote(sock, remoteJid, message, text) {
  await sock.sendMessage(remoteJid, { text }, { quoted: message });
}

// Fungsi kirim reaksi
async function sendReaction(sock, message, reaction) {
  return sock.sendMessage(message.key.remoteJid, {
    react: { text: reaction, key: message.key },
  });
}

// Fungsi utama handler
async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;

  const contohPakai = `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
    prefix + command
  } https://www.youtube.com/watch?v=xxxxx*_`;

  try {
    if (!content || !content.trim()) {
      return sendMessageWithQuote(sock, remoteJid, message, contohPakai);
    }

    const validLink = extractLink(content);

    // Dulu link yang tidak valid tetap dikirim ke API sebagai `null`, lalu
    // gagal belasan kali sampai akhirnya user cuma dapat error teknis.
    // Sekarang langsung diberi tahu di awal.
    if (!validLink) {
      await sendReaction(sock, message, '❗');
      return sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        `⛔ _Link YouTube tidak ditemukan di pesan Anda._\n\n${contohPakai}`,
      );
    }

    // Kirim reaksi "Loading"
    await sendReaction(sock, message, '⏰');

    // Retry & pembacaan link ditangani helper bersama (lib/ytdownloader.js).
    const api = new ApiAutoresbot(config.APIKEY);
    const { url: url_media } = await ambilMediaDenganRetry(
      api,
      '/api/downloader/ytplay',
      { url: validLink, format: 'm4a' },
      { label: `ytmp3 ${validLink}` },
    );

    const audioBuffer = await downloadToBuffer(url_media, 'mp3');

    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('File audio gagal diunduh dari server downloader.');
    }

    await sock.sendMessage(
      remoteJid,
      {
        audio: audioBuffer,
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
      pesanGagal('audio', error, `${prefix}${command} ${(content || '').trim()}`),
    );
  }
}

export default {
  handle,
  Commands: ['ytmp3'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
