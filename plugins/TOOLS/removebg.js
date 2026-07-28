import { downloadQuotedMedia, downloadMedia } from '../../lib/utils.js';
import mess from '../../strings.js';

import fs from 'fs';
import path from 'path';
import axios from 'axios';

import { uploadImageFile, logShort } from '../../lib/uploader.js';

import config from '../../config.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function handle(sock, messageInfo) {
  const { remoteJid, message, type, isQuoted, prefix, command } = messageInfo;

  try {
    const mediaType = isQuoted ? isQuoted.type : type;

    if (mediaType !== 'image') {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ _Kirim/Balas gambar dengan caption *${prefix + command}*_`,
        },
        { quoted: message },
      );
    }

    // React loading
    await sock.sendMessage(remoteJid, {
      react: { text: '⏰', key: message.key },
    });

    // Download media
    const media = isQuoted ? await downloadQuotedMedia(message) : await downloadMedia(message);

    const mediaPath = path.join('tmp', media);

    if (!fs.existsSync(mediaPath)) {
      throw new Error('File media tidak ditemukan.');
    }

    // Upload ke tmp.
    // Format dinormalisasi lebih dulu: WhatsApp menyimpan setiap imageMessage
    // sebagai .jpg walau isinya WebP/PNG, dan server uploader menolak bila isi
    // file tidak cocok dengan format yang dideklarasikan.
    const imageUrl = await uploadImageFile(mediaPath, { convert: true, label: 'REMOVEBG' });

    // ===============================
    // STEP 1: CREATE JOB
    // ===============================

    const createRes = await axios.get('https://api.autoresbot.com/api/tools/removebg', {
      params: { url: imageUrl },
      headers: {
        Authorization: `Bearer ${config.APIKEY}`,
      },
    });

    if (!createRes.data?.job_id) {
      throw new Error('Gagal membuat job removebg.');
    }

    const jobId = createRes.data.job_id;

    // ===============================
    // STEP 2: POLLING
    // ===============================

    const maxRetry = 10;
    const delayMs = 5000;
    let attempt = 0;
    let finalBase64 = null;

    while (attempt < maxRetry) {
      attempt++;
      //console.log(`Polling removebg attempt ${attempt}`);

      const pollRes = await axios.get('https://api.autoresbot.com/api/tools/removebg', {
        params: { job_id: jobId },
        headers: {
          Authorization: `Bearer ${config.APIKEY}`,
        },
        validateStatus: () => true,
      });

      const data = pollRes.data;

      if (data.status === 'done') {
        finalBase64 = data.result;
        //"RemoveBG selesai ✅");
        break;
      }

      if (data.status === 'failed') {
        throw new Error(data.error || 'RemoveBG gagal.');
      }

      //console.log("Masih processing...");
      await delay(delayMs);
    }

    if (!finalBase64) {
      throw new Error('Gagal mendapatkan hasil removebg.');
    }

    // ===============================
    // STEP 3: CONVERT BASE64 → BUFFER
    // ===============================

    const MediaBuffer = Buffer.from(finalBase64, 'base64');

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
    logShort('REMOVEBG', `Error: ${error?.serverMessage || error?.message || error}`, error);
    await sock.sendMessage(
      remoteJid,
      { text: 'Maaf, terjadi kesalahan. Coba lagi nanti!' },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['rmbg', 'removebg', 'nobg'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
