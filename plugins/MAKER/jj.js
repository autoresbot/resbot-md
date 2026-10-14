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

const JJ_URL = 'https://api.autoresbot.com/api/maker/jj-tiktok';

// Video dirender di server, jadi butuh waktu lebih lama dari maker gambar.
const http = axios.create({
  timeout: 120000,
  validateStatus: () => true,
});

const logJj = (shortMessage, detail) => logShort('JJ', shortMessage, detail);

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
        logJj('Unduhan gambar dari WhatsApp terputus');
        return await reply(
          m,
          '❌ Gagal mengunduh gambar dari WhatsApp.\n\nSilakan kirim ulang gambar dan coba lagi.',
        );
      }

      throw err;
    }

    const mediaPath = path.join('tmp', media);

    if (!fs.existsSync(mediaPath)) {
      logJj('File hasil unduhan tidak ditemukan');
      return await reply(m, '❌ File gambar tidak ditemukan.\nSilakan kirim ulang gambar.');
    }

    // ===============================
    // UPLOAD (format dinormalisasi otomatis)
    // ===============================
    let imageUrl;
    try {
      imageUrl = await uploadImageFile(mediaPath, { convert: true, label: 'JJ' });
    } catch (err) {
      const detail = err.serverMessage || err.message;
      logJj(`Upload gagal: ${detail}`, err);
      return await reply(m, withDetail('❌ Gagal mengupload gambar.', detail));
    }

    // ===============================
    // BUAT VIDEO
    // ===============================
    let res;
    try {
      res = await http.get(JJ_URL, {
        params: { apikey: config.APIKEY, url: imageUrl },
      });
    } catch (err) {
      const detail = formatNetworkError(err, 'API JJ');
      logJj(`Video gagal dibuat: ${detail}`, err);
      return await reply(m, withDetail('❌ Gagal membuat video.', detail));
    }

    const videoUrl = res.data?.result?.url;

    if (res.status !== 200 || !videoUrl) {
      const detail = formatApiResponse(res);
      logJj(`Video gagal dibuat: ${detail}`);
      const hint = isApikeyProblem(res) ? '\n\nCek apikey kamu, ketik *.apikey*' : '';
      return await reply(m, withDetail('❌ Gagal membuat video.', detail) + hint);
    }

    // ===============================
    // DOWNLOAD VIDEO HASIL
    // ===============================
    const videoRes = await http.get(videoUrl, {
      responseType: 'arraybuffer',
    });

    if (videoRes.status !== 200) {
      const detail = formatApiResponse(videoRes);
      logJj(`Gagal mengambil hasil: ${detail}`);
      return await reply(m, withDetail('❌ Gagal mengambil hasil video.', detail));
    }

    await sock.sendMessage(
      remoteJid,
      {
        video: Buffer.from(videoRes.data),
        mimetype: 'video/mp4',
        caption: mess.general.success,
      },
      { quoted: message },
    );
  } catch (error) {
    // Hanya satu baris ringkas di console; stack lengkap masuk logs/api.log.
    const detail =
      error?.serverMessage ||
      (error?.isAxiosError ? formatNetworkError(error, 'API JJ') : error?.message || String(error));
    logJj(`Error: ${detail}`, error);
    await reply(
      m,
      `❌ Terjadi kesalahan saat membuat video.\nSilakan coba lagi nanti.\n\n*Detail:* ${detail}`,
    );
  }
}

export default {
  handle,
  Commands: ['jj', 'jjtiktok'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
