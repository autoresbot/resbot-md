import { downloadQuotedMedia, downloadMedia, reply } from '../../lib/utils.js';
import fs from 'fs';
import path from 'path';
import mess from '../../strings.js';
import axios from 'axios';
import ApiAutoresbotModule from 'api-autoresbot';
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;
import config from '../../config.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 🔥 Axios instance dengan timeout & debug
const http = axios.create({
  timeout: 30000,
  validateStatus: () => true,
});

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, prefix, command, type, isQuoted } = messageInfo;

  try {
    console.log('===== REMINI START =====');
    console.log('User:', remoteJid);

    const mediaType = isQuoted ? isQuoted.type : type;
    if (mediaType !== 'image') {
      return await reply(m, `⚠️ _Kirim/Balas gambar dengan caption *${prefix + command}*_`);
    }

    await sock.sendMessage(remoteJid, {
      react: { text: '⏰', key: message.key },
    });

    console.log('Downloading media...');
    const media = isQuoted ? await downloadQuotedMedia(message) : await downloadMedia(message);
    const mediaPath = path.join('tmp', media);

    if (!fs.existsSync(mediaPath)) {
      throw new Error('File media tidak ditemukan.');
    }

    console.log('Uploading to tmp...');
    const api = new ApiAutoresbot(config.APIKEY);
    const upload = await api.tmpUpload(mediaPath);

    if (!upload || upload.code !== 200) {
      console.log('Upload response:', upload);
      throw new Error('Upload gagal.');
    }

    const imageUrl = upload.data.url;
    console.log('Image URL:', imageUrl);

    // ===============================
    // CREATE JOB
    // ===============================

    console.log('Creating job...');
    const createRes = await http.get(`https://api.autoresbot.com/api/tools/remini`, {
      params: { url: imageUrl },
      headers: {
        Authorization: `Bearer ${config.APIKEY}`,
      },
    });

    console.log('Create response:', createRes.status, createRes.data);

    if (!createRes.data?.job_id) {
      throw new Error('Gagal membuat job.');
    }

    const jobId = createRes.data.job_id;
    console.log('Job ID:', jobId);

    // ===============================
    // POLLING
    // ===============================

    const maxRetry = 10;
    const delayMs = 7000;
    let attempt = 0;
    let finalImageUrl = null;

    while (attempt < maxRetry) {
      attempt++;
      console.log(`Polling attempt ${attempt} for job ${jobId}`);

      try {
        const pollRes = await http.get(`https://api.autoresbot.com/api/tools/remini`, {
          params: { job_id: jobId },
          headers: {
            Authorization: `Bearer ${config.APIKEY}`,
          },
        });

        console.log('Poll response:', pollRes.status, pollRes.data);

        const data = pollRes.data;

        if (data.status === 'done') {
          finalImageUrl = data.result;
          console.log('Job selesai ✅', finalImageUrl);
          break;
        }

        if (data.status === 'failed') {
          throw new Error(data.error || 'Remini gagal.');
        }
      } catch (pollError) {
        console.error('Polling error:', pollError.code, pollError.message);

        if (pollError.code === 'ECONNRESET') {
          console.log('⚠️ ECONNRESET saat polling, retry...');
        } else {
          throw pollError;
        }
      }

      await delay(delayMs);
    }

    if (!finalImageUrl) {
      throw new Error('Gagal mendapatkan hasil setelah polling.');
    }

    // ===============================
    // DOWNLOAD FINAL IMAGE
    // ===============================

    console.log('Downloading final image...');
    const imageRes = await http.get(finalImageUrl, {
      responseType: 'arraybuffer',
    });

    console.log('Final image status:', imageRes.status);

    if (imageRes.status !== 200) {
      throw new Error('Gagal download hasil akhir.');
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

    console.log('===== REMINI SUCCESS =====');
  } catch (error) {
    console.error('===== REMINI ERROR =====');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    console.error('Stack:', error.stack);

    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', error.response.data);
    }

    await reply(m, `_Terjadi kesalahan saat memproses gambar._\n\nERROR: ${error.message}`);
  }
}

export default {
  handle,
  Commands: ['hd', 'remini'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
