import { downloadQuotedMedia, downloadMedia, reply } from '../../lib/utils.js';
import fs from 'fs';
import path from 'path';
import mess from '../../strings.js';
import axios from 'axios';
import ApiAutoresbotModule from 'api-autoresbot';
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;
import config from '../../config.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const http = axios.create({
  timeout: 30000,
  validateStatus: () => true,
});

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
    // UPLOAD
    // ===============================
    const api = new ApiAutoresbot(config.APIKEY);
    const upload = await api.tmpUpload(mediaPath);

    if (!upload || upload.code !== 200) {
      return await reply(m, '❌ Gagal mengupload gambar.\nSilakan coba beberapa saat lagi.');
    }

    const imageUrl = upload.data.url;

    // ===============================
    // CREATE JOB
    // ===============================
    const createRes = await http.get('https://api.autoresbot.com/api/tools/remini', {
      params: { url: imageUrl },
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
