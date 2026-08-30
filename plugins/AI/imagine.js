import { reply } from '../../lib/utils.js';
import mess from '../../strings.js';
import axios from 'axios';
import config from '../../config.js';
import { logShort } from '../../lib/uploader.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const API_BASE_URL = 'https://api.autoresbot.com';
const CREATE_ENDPOINT = `${API_BASE_URL}/api/ai-image-create`;
const POLLING_ENDPOINT = `${API_BASE_URL}/api/ai-image-create`;

const http = axios.create({
  timeout: 120000,
  validateStatus: () => true,
});

async function handle(sock, messageInfo) {
  const {
    m,
    remoteJid,
    message,
    prefix,
    command,
    content,
  } = messageInfo;

  try {
    const prompt = typeof content === 'string' ? content.trim() : '';

    if (!prompt) {
      return await reply(
        m,
        `⚠️ _Masukkan prompt gambar yang ingin dibuat._

_Contoh:_
_${prefix + command} wanita Indonesia sedang berada di pantai saat matahari terbenam_`,
      );
    }

    await sock.sendMessage(remoteJid, {
      react: {
        text: '⏰',
        key: message.key,
      },
    });

    // ===============================
    // CREATE IMAGE
    // ===============================
    const createRes = await http.get(CREATE_ENDPOINT, {
      params: {
        prompt,
      },
      headers: {
        Authorization: `Bearer ${config.APIKEY}`,
      },
    });

    if (createRes.status < 200 || createRes.status >= 300) {
      logShort(
        'AIIMG',
        `Create gagal (${createRes.status}): ${
          createRes.data?.message || JSON.stringify(createRes.data)
        }`,
      );

      return await reply(
        m,
        createRes.data?.message ||
          '❌ Gagal membuat gambar.\nSilakan coba lagi.',
      );
    }

    const createData = createRes.data;

    if (createData?.status === 'failed') {
      return await reply(
        m,
        createData?.message ||
          '❌ Proses pembuatan gambar gagal.\nSilakan coba lagi.',
      );
    }

    let finalImageUrl = null;

    // Endpoint langsung memberikan hasil gambar.
    if (createData?.status === 'done' && createData?.result) {
      finalImageUrl = createData.result;
    }

    // Jika endpoint menggunakan sistem job/polling.
    else if (createData?.job_id) {
      const jobId = createData.job_id;
      const maxRetry = 10;
      const delayMs = 7000;

      let attempt = 0;

      while (attempt < maxRetry) {
        attempt++;

        try {
          const pollRes = await http.get(POLLING_ENDPOINT, {
            params: {
              job_id: jobId,
            },
            headers: {
              Authorization: `Bearer ${config.APIKEY}`,
            },
          });

          if (pollRes.status >= 200 && pollRes.status < 300) {
            const pollData = pollRes.data;

            if (pollData?.status === 'done') {
              finalImageUrl =
                pollData.result ||
                pollData.url ||
                pollData.image_url;

              break;
            }

            if (pollData?.status === 'failed') {
              return await reply(
                m,
                pollData?.message ||
                  '❌ Proses pembuatan gambar gagal.\nSilakan coba lagi.',
              );
            }
          }
        } catch (pollError) {
          if (
            pollError.code !== 'ECONNRESET' &&
            pollError.code !== 'ETIMEDOUT'
          ) {
            throw pollError;
          }
        }

        if (attempt < maxRetry) {
          await delay(delayMs);
        }
      }
    }

    // Format cadangan jika API hanya mengembalikan result.
    else if (createData?.result) {
      finalImageUrl = createData.result;
    }

    if (!finalImageUrl) {
      logShort(
        'AIIMG',
        `URL hasil tidak ditemukan: ${JSON.stringify(createData)}`,
      );

      return await reply(
        m,
        '❌ URL hasil gambar tidak ditemukan.\nSilakan coba lagi.',
      );
    }

    // ===============================
    // DOWNLOAD FINAL IMAGE
    // ===============================
    const imageRes = await http.get(finalImageUrl, {
      responseType: 'arraybuffer',
    });

    if (imageRes.status < 200 || imageRes.status >= 300) {
      return await reply(
        m,
        '❌ Gagal mengambil hasil gambar.\nSilakan coba lagi.',
      );
    }

    const mediaBuffer = Buffer.from(imageRes.data);

    await sock.sendMessage(
      remoteJid,
      {
        image: mediaBuffer,
        caption: mess.general.success,
      },
      {
        quoted: message,
      },
    );

    await sock.sendMessage(remoteJid, {
      react: {
        text: '✅',
        key: message.key,
      },
    });
  } catch (error) {
    logShort(
      'AIIMG',
      `Error: ${error?.serverMessage || error?.message || error}`,
      error,
    );

    await reply(
      m,
      '❌ Terjadi kesalahan saat membuat gambar.\nSilakan coba lagi nanti.',
    );
  }
}

export default {
  handle,
  Commands: ['imagine'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};