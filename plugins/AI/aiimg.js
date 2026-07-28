import { downloadQuotedMedia, downloadMedia, reply } from '../../lib/utils.js';
import fs from 'fs';
import path from 'path';
import mess from '../../strings.js';
import axios from 'axios';
import config from '../../config.js';
import { uploadImageFile, logShort } from '../../lib/uploader.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const http = axios.create({
  timeout: 30000,
  validateStatus: () => true,
});

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, prefix, command, type, isQuoted, content } = messageInfo;

  try {
    const mediaType = isQuoted ? isQuoted.type : type;
    if (mediaType !== 'image') {
      return await reply(m, `⚠️ _Kirim/Balas gambar dengan caption *${prefix + command}*_`);
    }

    // Validasi input
    if (!content) {
      return await reply(
        m,
        `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _${
          prefix + command
        } https://chat.whatsapp.com/xxxxxxxxxxxxxxxx_`,
      );
    }

    await sock.sendMessage(remoteJid, {
      react: { text: '⏰', key: message.key },
    });

    // ===============================
    // DOWNLOAD MEDIA (WA SAFE)
    // ===============================
    let media;

    try {
      media = isQuoted ? await downloadQuotedMedia(message) : await downloadMedia(message);
    } catch (err) {
      if (err.code === 'ECONNRESET' || err.message?.includes('terminated')) {
        return await reply(
          m,
          '❌ Gagal mengunduh gambar dari WhatsApp.\n\nSilakan kirim ulang gambar dan coba lagi.',
        );
      }

      throw err;
    }

    const mediaPath = path.join('tmp', media);

    if (!fs.existsSync(mediaPath)) {
      return await reply(m, '❌ File gambar tidak ditemukan.\nSilakan kirim ulang gambar.');
    }

    // ===============================
    // UPLOAD (format dinormalisasi otomatis)
    // ===============================
    // WhatsApp menyimpan setiap imageMessage sebagai .jpg walau isinya
    // WebP/PNG; server uploader menolak bila isi tidak cocok dengan format
    // yang dideklarasikan.
    let imageUrl;
    try {
      imageUrl = await uploadImageFile(mediaPath, { convert: true, label: 'AIIMG' });
    } catch (err) {
      logShort('AIIMG', `Upload gagal: ${err.serverMessage || err.message}`, err);
      return await reply(m, '❌ Gagal mengupload gambar.\nSilakan coba beberapa saat lagi.');
    }

    // ===============================
    // CREATE JOB
    // ===============================

    const createRes = await http.get('https://api.autoresbot.com/api/ai-image', {
      params: { url: imageUrl, prompt: content },
      headers: {
        Authorization: `Bearer ${config.APIKEY}`,
      },
    });

    if (!createRes.data?.job_id) {
      return await reply(m, '❌ Gagal memproses gambar.\nSilakan coba lagi.');
    }

    const jobId = createRes.data.job_id;

    // ===============================
    // POLLING
    // ===============================
    const maxRetry = 10;
    const delayMs = 7000;
    let attempt = 0;
    let finalImageUrl = null;

    while (attempt < maxRetry) {
      attempt++;

      try {
        const pollRes = await http.get('https://api.autoresbot.com/api/tools/remini', {
          params: { job_id: jobId },
          headers: {
            Authorization: `Bearer ${config.APIKEY}`,
          },
        });

        const data = pollRes.data;

        if (data.status === 'done') {
          finalImageUrl = data.result;
          break;
        }

        if (data.status === 'failed') {
          return await reply(m, '❌ Proses HD gagal.\nSilakan coba lagi.');
        }
      } catch (pollError) {
        if (pollError.code !== 'ECONNRESET') {
          throw pollError;
        }
      }

      await delay(delayMs);
    }

    if (!finalImageUrl) {
      return await reply(m, '❌ Waktu proses terlalu lama.\nSilakan coba lagi nanti.');
    }

    // ===============================
    // DOWNLOAD FINAL IMAGE
    // ===============================
    const imageRes = await http.get(finalImageUrl, {
      responseType: 'arraybuffer',
    });

    if (imageRes.status !== 200) {
      return await reply(m, '❌ Gagal mengambil hasil gambar.\nSilakan coba lagi.');
    }

    const MediaBuffer = Buffer.from(imageRes.data);

    await sock.sendMessage(
      remoteJid,
      {
        image: MediaBuffer,
        caption: mess.general.success,
      },
      { quoted: message },
    );
  } catch (error) {
    // Satu baris ringkas di console; detail lengkap masuk logs/api.log.
    logShort('AIIMG', `Error: ${error?.serverMessage || error?.message || error}`, error);
    await reply(m, '❌ Terjadi kesalahan saat memproses gambar.\nSilakan coba lagi nanti.');
  }
}

export default {
  handle,
  Commands: ['aiimg'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
