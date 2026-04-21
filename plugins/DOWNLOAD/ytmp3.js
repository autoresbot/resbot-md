import ApiAutoresbotModule from 'api-autoresbot';
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from '../../config.js';
import { logCustom } from '../../lib/logger.js';
import { extractLink, downloadToBuffer } from '../../lib/utils.js';

// Fungsi kirim pesan dengan quote
async function sendMessageWithQuote(sock, remoteJid, message, text) {
  await sock.sendMessage(remoteJid, { text }, { quoted: message });
}

// Fungsi delay (jeda)
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fungsi untuk mencoba request API hingga 3 kali
async function fetchWithRetry(api, endpoint, params, maxRetries = 6, delayMs = 9000) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await api.get(endpoint, params);
      if (response && response.status && response.data.url) {
        //console.log(`✅ Berhasil pada percobaan ke-${attempt}`);
        return response;
      }
      throw new Error(`API response invalid (percobaan ${attempt})`);
    } catch (err) {
      lastError = err;
      //console.warn(`❌ Percobaan ke-${attempt} gagal: ${err.message}`);
      if (attempt < maxRetries) {
        //console.log(`⏳ Menunggu ${delayMs / 1000} detik sebelum mencoba lagi...`);
        await delay(delayMs);
      }
    }
  }
  throw lastError;
}

// Fungsi utama handler
async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;

  try {
    const validLink = extractLink(content);

    if (!content.trim() || content.trim() === '') {
      return sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
          prefix + command
        } https://www.youtube.com/watch?v=xxxxx*_`,
      );
    }

    // Kirim reaksi "Loading"
    await sock.sendMessage(remoteJid, {
      react: { text: '⏰', key: message.key },
    });

    const api = new ApiAutoresbot(config.APIKEY);

    // Coba request API maksimal 3x
    const response = await fetchWithRetry(
      api,
      '/api/downloader/ytplay',
      { url: validLink, format: 'm4a' },
      6,
      9000,
    );

    if (response.status) {
      const url_media = response.data.url;

      const audioBuffer = await downloadToBuffer(url_media, 'mp3');

      await sock.sendMessage(
        remoteJid,
        {
          audio: audioBuffer,
          mimetype: 'audio/mp4',
        },
        { quoted: message },
      );
    } else {
      logCustom('info', content, `ERROR-COMMAND-${command}.txt`);
      await sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        'Maaf, tidak dapat menemukan audio dari URL yang Anda berikan.',
      );
    }
  } catch (error) {
    logCustom('info', content, `ERROR-COMMAND-${command}.txt`);
    const errorMessage = `Maaf, terjadi kesalahan saat memproses permintaan Anda. Mohon coba lagi nanti.\n\nDetail Error: ${
      error.message || error
    }`;
    await sendMessageWithQuote(sock, remoteJid, message, errorMessage);
  }
}

export default {
  handle,
  Commands: ['ytmp3'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
