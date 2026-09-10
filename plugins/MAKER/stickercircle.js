import ApiAutoresbotModule from 'api-autoresbot';
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from '../../config.js';
import { sendImageAsSticker } from '../../lib/exif.js';

import { downloadQuotedMedia, downloadMedia } from '../../lib/utils.js';
import { uploadImageFile, logShort } from '../../lib/uploader.js';

import sharp from 'sharp';

import fs from 'fs';
import path from 'path';

async function handle(sock, messageInfo) {
  const { remoteJid, message, type, isQuoted, content, prefix, command } = messageInfo;
  try {
    await sock.sendMessage(remoteJid, {
      react: { text: '⏰', key: message.key },
    });

    const mediaType = isQuoted ? isQuoted.type : type;

    // Hanya proses image dan sticker
    if (mediaType !== 'image' && mediaType !== 'sticker') {
      return sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ _Kirim/Balas gambar dengan caption *${prefix + command}*_`,
        },
        { quoted: message },
      );
    }

    // Unduh media
    const media = isQuoted ? await downloadQuotedMedia(message) : await downloadMedia(message);

    const mediaPath = path.join('tmp', media);
    if (!fs.existsSync(mediaPath)) {
      throw new Error('File media tidak ditemukan setelah diunduh.');
    }

    // convert: false — plugin ini menerima gambar MAUPUN sticker, dan sticker
    // (WebP) harus tetap dikirim apa adanya. Yang dibetulkan hanya nama file &
    // content-type agar cocok dengan isi sebenarnya.
    const url = await uploadImageFile(mediaPath, {
      convert: false,
      label: 'STICKERCIRCLE',
    });

    const api = new ApiAutoresbot(config.APIKEY);

    if (url) {
      // Ambil buffer hasil API stickercircle

      const buffer = await api.getBuffer('/api/maker/stickercircle', {
        url: url,
      });

      // Konversi ke webp
      const webpBuffer = await sharp(buffer).webp().toBuffer();

      const options = {
        packname: config.sticker_packname,
        author: config.sticker_author,
      };

      await sendImageAsSticker(sock, remoteJid, webpBuffer, options, message);
    }
  } catch (error) {
    // Satu baris ringkas di console; detail lengkap masuk logs/api.log.
    logShort('STICKERCIRCLE', `Error: ${error?.serverMessage || error?.message || error}`, error);
    await sock.sendMessage(
      remoteJid,
      { text: 'Maaf, terjadi kesalahan. Coba lagi nanti!' },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['stickercircle', 'scircle'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
