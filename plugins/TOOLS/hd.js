import { downloadQuotedMedia, downloadMedia, reply } from '../../lib/utils.js';
import fs from 'fs';
import path from 'path';
import mess from '../../strings.js';
import axios from 'axios';
import config from '../../config.js';
import {
  uploadImageFile,
  logShort,
  formatApiResponse,
  formatNetworkError,
} from '../../lib/uploader.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const REMINI_URL = 'https://api.autoresbot.com/api/tools/remini';

const http = axios.create({
  timeout: 30000,
  validateStatus: () => true,
});

const logHd = (shortMessage, detail) => logShort('HD', shortMessage, detail);

// Respons API ikut ditampilkan ke pengguna supaya penyebab gagalnya jelas
// (apikey habis/salah, format ditolak, server sibuk, dll) — dulu yang tampil
// hanya pesan umum "Silakan coba lagi" untuk semua jenis kegagalan.
const withDetail = (text, detail) => (detail ? `${text}\n\n*Respon API:* ${detail}` : text);

// Error 401/403 atau kode error berisi "KEY" hampir pasti soal apikey.
const isApikeyProblem = (res) =>
  res?.status === 401 ||
  res?.status === 403 ||
  /key/i.test(String(res?.data?.error_code || '')) ||
  /apikey/i.test(String(res?.data?.message || ''));

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
      const detail = err.serverMessage || err.message;
      logHd(`Upload gagal: ${detail}`, err);
      return await reply(m, withDetail('❌ Gagal mengupload gambar.', detail));
    }

    // ===============================
    // CREATE JOB
    // ===============================
    let createRes;
    try {
      createRes = await http.get(REMINI_URL, {
        params: { url: imageUrl },
        headers: {
          Authorization: `Bearer ${config.APIKEY}`,
        },
      });
    } catch (err) {
      const detail = formatNetworkError(err, 'API HD');
      logHd(`Job gagal dibuat: ${detail}`, err);
      return await reply(m, withDetail('❌ Gagal memproses gambar.', detail));
    }

    if (!createRes.data?.job_id) {
      const detail = formatApiResponse(createRes);
      logHd(`Job gagal dibuat: ${detail}`);
      const hint = isApikeyProblem(createRes) ? '\n\nCek apikey kamu, ketik *.apikey*' : '';
      return await reply(m, withDetail('❌ Gagal memproses gambar.', detail) + hint);
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

        const data = pollRes.data || {};

        // Error 4xx saat polling (job tidak ditemukan, apikey ditolak, dll)
        // tidak akan berubah dengan menunggu — dulu tetap diulang sampai
        // timeout ~70 detik lalu hanya tampil "Waktu proses terlalu lama".
        // 5xx dianggap gangguan sementara dan tetap dicoba lagi.
        if (pollRes.status >= 400 && pollRes.status < 500) {
          const detail = formatApiResponse(pollRes);
          logHd(`Polling gagal: ${detail}`);
          return await reply(m, withDetail('❌ Proses HD gagal.', detail));
        }

        if (data.status === 'done') {
          finalImageUrl = data.result;
          break;
        }

        if (data.status === 'failed') {
          const detail = formatApiResponse(pollRes);
          logHd(`Proses HD dilaporkan gagal oleh server: ${detail}`);
          return await reply(m, withDetail('❌ Proses HD gagal.\nSilakan coba lagi.', detail));
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
      return await reply(
        m,
        withDetail(
          '❌ Waktu proses terlalu lama.\nSilakan coba lagi nanti.',
          `Gambar belum selesai diproses setelah ${(maxRetry * delayMs) / 1000} detik`,
        ),
      );
    }

    // ===============================
    // DOWNLOAD FINAL IMAGE
    // ===============================
    const imageRes = await http.get(finalImageUrl, {
      responseType: 'arraybuffer',
    });

    if (imageRes.status !== 200) {
      const detail = formatApiResponse(imageRes);
      logHd(`Gagal mengambil hasil: ${detail}`);
      return await reply(m, withDetail('❌ Gagal mengambil hasil gambar.', detail));
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
    const detail =
      error?.serverMessage ||
      (error?.isAxiosError ? formatNetworkError(error, 'API HD') : error?.message || String(error));
    logHd(`Error: ${detail}`, error);
    await reply(
      m,
      `❌ Terjadi kesalahan saat memproses gambar.\nSilakan coba lagi nanti.\n\n*Detail:* ${detail}`,
    );
  }
}

export default {
  handle,
  Commands: ['hd', 'remini'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
