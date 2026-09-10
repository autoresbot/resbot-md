import ApiAutoresbotModule from 'api-autoresbot';
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import fs from 'fs'; // Menambahkan modul fs untuk menghapus file tmp
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

// Fungsi konversi milidetik ke format Menit:Detik (MM:SS)
function formatDuration(ms) {
  if (!ms) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Fungsi untuk mencoba request API hingga 6 kali
async function fetchWithRetry(api, endpoint, params, maxRetries = 6, delayMs = 9000) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await api.get(endpoint, params);
      if (response && response.status && response.data?.convert?.url) {
        return response;
      }
      throw new Error(`API response invalid (percobaan ${attempt})`);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await delay(delayMs);
      }
    }
  }
  throw lastError;
}

// Fungsi utama handler
async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;
  let audioPathTmp = null; // Menyimpan path file temporary jika fungsi download mengembalikannya

  try {
    const validLink = extractLink(content);

    if (!content.trim() || content.trim() === '') {
      return sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
          prefix + command
        } https://open.spotify.com/track/xxxxx*_`,
      );
    }

    // Kirimkan pesan loading 
      await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const api = new ApiAutoresbot(config.APIKEY);

    // Request ke endpoint spotify downloader sesuai struktur yang valid
    const response = await fetchWithRetry(
      api,
      '/api/downloader/spotify',
      { url: validLink },
      6,
      9000,
    );

    if (response && response.status && response.data?.convert?.url) {
      const url_media = response.data.convert.url;
      
      // Mengambil data track
      const trackData = response.data.track;
      const trackName = trackData?.name || 'Spotify Audio';
      const artistName = trackData?.artists?.[0]?.name || '';
      const albumName = trackData?.album?.name || '-';
      const durationMs = trackData?.duration_ms || 0;
      
      // Format durasi menjadi Menit:Detik
      const durationFormatted = formatDuration(durationMs);
      const fullTitle = artistName ? `${trackName} - ${artistName}` : trackName;
      
      // Mengambil link gambar album
      const imageUrl = trackData?.album?.images?.[0]?.url || '';

      // Teks caption dengan font biasa (Bold standar WhatsApp) yang rapi
      const captionText = `•───────────🪽───────────•\n` +
                          `       *SPOTIFY DOWNLOADER*\n` +
                          `•───────────🪽───────────•\n\n` +
                          ` *Judul* : ${trackName}\n` +
                          ` *Artis* : ${artistName}\n` +
                          ` *Album* : ${albumName}\n` +
                          ` *Durasi* : ${durationFormatted}\n\n` +
                          `•─────────────────────────•\n` +
                          `*⏳ Sedang mengirim file audio, mohon tunggu...*`;

      // Kirim pesan gambar + caption teks detail lagu
      if (imageUrl) {
        await sock.sendMessage(
          remoteJid,
          {
            image: { url: imageUrl },
            caption: captionText
          },
          { quoted: message }
        );
      } else {
        await sendMessageWithQuote(sock, remoteJid, message, captionText);
      }

      // Mengunduh musik ke buffer internal
      const audioBuffer = await downloadToBuffer(url_media, 'mp3');

      // Mengirimkan audio ke WhatsApp user
      await sock.sendMessage(
        remoteJid,
        {
          audio: audioBuffer,
          mimetype: 'audio/mp4',
          fileName: `${fullTitle}.mp3`
        },
        { quoted: message },
      );

      // Otomatis mencari dan menghapus file sampah di folder tmp berdasarkan nama judul/struktur berkas jika berupa path string
      // Jika downloadToBuffer mengembalikan objek yang menyimpan properti path:
      if (audioBuffer && typeof audioBuffer === 'string') {
        if (fs.existsSync(audioBuffer)) fs.unlinkSync(audioBuffer);
      } else if (audioBuffer?.path && fs.existsSync(audioBuffer.path)) {
        fs.unlinkSync(audioBuffer.path);
      }

    } else {
      logCustom('info', content, `ERROR-COMMAND-${command}.txt`);
      await sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        'Maaf, server Autoresbot tidak memberikan respon link unduhan untuk lagu tersebut saat ini.',
      );
    }
  } catch (error) {
    logCustom('info', content, `ERROR-COMMAND-${command}.txt`);
    const errorMessage = `Maaf, terjadi kesalahan saat memproses permintaan Anda.\n\nDetail Error: ${
      error.message || error
    }`;
    await sendMessageWithQuote(sock, remoteJid, message, errorMessage);
  }
}

export default {
  handle,
  Commands: ['spotifydl','sdl'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};