import ApiAutoresbotModule from 'api-autoresbot';
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;
import fs from 'fs';
import path from 'path';

import config from '../../config.js';
import { sendImageAsSticker } from '../../lib/exif.js';
import { downloadQuotedMedia, downloadMedia } from '../../lib/utils.js';

function detectMime(buffer) {
  if (!buffer || buffer.length < 12) return null;

  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }

  // JPG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // GIF
  if (
    buffer.subarray(0, 6).toString() === 'GIF87a' ||
    buffer.subarray(0, 6).toString() === 'GIF89a'
  ) {
    return 'image/gif';
  }

  // WEBP
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') {
    return 'image/webp';
  }

  return null;
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, type, isQuoted, content, prefix, command } = messageInfo;

  try {
    if (!content) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_\n\n_💬 Contoh:_ *${prefix + command} atas|bawah*`,
        },
        { quoted: message },
      );
    }

    await sock.sendMessage(remoteJid, {
      react: {
        text: '⏰',
        key: message.key,
      },
    });

    const mediaType = isQuoted ? isQuoted.type : type;

    if (!['image', 'sticker'].includes(mediaType)) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ Kirim atau balas gambar/sticker dengan caption *${prefix + command}*`,
        },
        { quoted: message },
      );
    }

    const [text1 = '', text2 = ''] = content.split('|');

    const media = isQuoted ? await downloadQuotedMedia(message) : await downloadMedia(message);

    const mediaPath = path.join('tmp', media);
    if (!fs.existsSync(mediaPath)) {
      throw new Error('File media tidak ditemukan setelah diunduh.');
    }

    const api = new ApiAutoresbot(config.APIKEY);

    const uploadResult = await api.tmpUpload(mediaPath);

    if (
      !uploadResult ||
      uploadResult.code !== 200 ||
      !uploadResult.data ||
      !uploadResult.data.url
    ) {
      throw new Error('Upload media gagal.');
    }

    const imageUrl = uploadResult.data.url;

    const buffer = await api.getBuffer('/api/maker/smeme', {
      text: text1,
      text2,
      pp: imageUrl,
      width: 500,
      height: 500,
    });

    const mime = detectMime(buffer);

    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error('API smeme tidak mengembalikan buffer yang valid.');
    }

    if (mime === 'image/webp') {
      // Kirimkan stiker sebagai respon
      await sock.sendMessage(
        remoteJid,
        {
          sticker: buffer,
        },
        { quoted: message },
      );
    } else if (mime === 'image/png') {
      await sendImageAsSticker(
        sock,
        remoteJid,
        buffer,
        {
          packname: config.sticker_packname,
          author: config.sticker_author,
        },
        message,
      );
    }

    // await sock.sendMessage(remoteJid, {
    //   react: {
    //     text: '✅',
    //     key: message.key,
    //   },
    // });
  } catch (error) {
    console.error('[SMEME ERROR]', error);

    await sock.sendMessage(
      remoteJid,
      {
        text: `❌ Gagal membuat sticker meme.\n\n${error.message}`,
      },
      { quoted: message },
    );

    try {
      await sock.sendMessage(remoteJid, {
        react: {
          text: '❌',
          key: message.key,
        },
      });
    } catch {}
  } finally {
  }
}

export default {
  handle,
  Commands: ['smeme'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
