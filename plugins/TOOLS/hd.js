import { downloadQuotedMedia, downloadMedia, reply } from '../../lib/utils.js';
import fs from 'fs';
import path from 'path';
import mess from '../../strings.js';
import axios from 'axios';
import config from '../../config.js';
import { uploadImageFile, logShort } from '../../lib/uploader.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const REMINI_URL = 'https://api.autoresbot.com/api/tools/remini';

const http = axios.create({
  timeout: 30000,
  validateStatus: () => true,
});

const logHd = (shortMessage, detail) => logShort('HD', shortMessage, detail);

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, prefix, command, type, isQuoted } = messageInfo;

  try {
    const mediaType = isQuoted ? isQuoted.type : type;
    if (mediaType !== 'image') {
      return await reply(m, `⚠️ _Kirim/Balas gambar dengan caption *${prefix + command}*_`);
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
        logHd('Unduhan gambar dari WhatsApp terputus');
        return await reply(
          m,
          '❌ Gagal mengunduh gambar dari WhatsApp.\n\nSilakan kirim ulang gambar dan coba lagi.',
        );
      }

      throw err;
    }

    const mediaPath = path.join('tmp', media);

    if (!fs.existsSync(mediaPath)) {
      logHd('File hasil unduhan tidak ditemukan');
      return await reply(m, '❌ File gambar tidak ditemukan.\nSilakan kirim ulang gambar.');
    }

    // ===============================
    // UPLOAD (format dinormalisasi otomatis)
    // ===============================
    // WhatsApp selalu menyimpan imageMessage dengan ekstensi .jpg, padahal
    // isinya bisa WebP/PNG/GIF. Server uploader memeriksa ISI file, bukan
    // ekstensinya, lalu menolak bila tidak cocok. uploadImageFile mendeteksi
    // format sebenarnya dari magic bytes dan mengonversinya ke JPEG bila perlu.
    let imageUrl;
    try {
      imageUrl = await uploadImageFile(mediaPath, { convert: true, label: 'HD' });
    } catch (err) {
      logHd(`Upload gagal: ${err.serverMessage || err.message}`, err);
      return await reply(m, '❌ Gagal mengupload gambar.\nSilakan coba beberapa saat lagi.');
    }

    // ===============================
    // CREATE JOB
    // ===============================
    const createRes = await http.get(REMINI_URL, {
      params: { url: imageUrl },
      headers: {
        Authorization: `Bearer ${config.APIKEY}`,
      },
    });

    if (!createRes.data?.job_id) {
      logHd(`Job gagal dibuat: ${createRes.data?.message || `HTTP ${createRes.status}`}`);
      return await reply(m, '❌ Gagal memproses gambar.\nPastikan Apikey Tersedia, ketik .apikey');
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
        const pollRes = await http.get(REMINI_URL, {
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
          logHd('Proses HD dilaporkan gagal oleh server');
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
      logHd(`Timeout setelah ${maxRetry} kali pengecekan`);
      return await reply(m, '❌ Waktu proses terlalu lama.\nSilakan coba lagi nanti.');
    }

    // ===============================
    // DOWNLOAD FINAL IMAGE
    // ===============================
    const imageRes = await http.get(finalImageUrl, {
      responseType: 'arraybuffer',
    });

    if (imageRes.status !== 200) {
      logHd(`Gagal mengambil hasil: HTTP ${imageRes.status}`);
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
    // Hanya satu baris ringkas di console; stack lengkap masuk logs/api.log.
    logHd(`Error: ${error?.message || error}`, error);
    await reply(m, '❌ Terjadi kesalahan saat memproses gambar.\nSilakan coba lagi nanti.');
  }
}

export default {
  handle,
  Commands: ['hd', 'remini'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
