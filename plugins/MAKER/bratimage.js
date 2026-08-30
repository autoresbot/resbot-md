import ApiAutoresbotModule from 'api-autoresbot';

import config from '../../config.js';
import { sendImageAsSticker } from '../../lib/exif.js';
import { logShort } from '../../lib/uploader.js';

const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

const IMAGE_BY_COMMAND = {
  bratbahlil: 'bahlil',
  bratcewek: 'cewek',
  bratanime: 'anime',
};

/**
 * API mengembalikan buffer gambar bila sukses, tetapi mengembalikan JSON
 * (mis. apikey habis / tidak valid) bila gagal. Cek magic bytes supaya pesan
 * error asli dari server bisa ditampilkan ke user.
 */
function isImageBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;

  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return true;
  }

  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;

  // WEBP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return true;
  }

  return false;
}

function readServerMessage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;

  const raw = buffer.subarray(0, 500).toString('utf8').trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(buffer.toString('utf8'));
    return parsed?.message || parsed?.error || raw;
  } catch {
    return raw;
  }
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, isQuoted, prefix, command } = messageInfo;

  try {
    const rawText = content?.trim() || isQuoted?.text?.trim() || '';
    const commandName = command?.toLowerCase();
    const image = IMAGE_BY_COMMAND[commandName];

    if (!image) {
      throw new Error(`Command "${command}" tidak dikenali.`);
    }

    if (!rawText) {
      return await sock.sendMessage(
        remoteJid,
        {
          text:
            `_⚠️ Format Penggunaan:_\n\n` +
            `*${prefix + command} teks*\n\n` +
            `_💬 Contoh:_\n` +
            `*${prefix + command} resbot md*`,
        },
        { quoted: message },
      );
    }

    const text = rawText.replace(/\n+/g, ' ');

    await sock.sendMessage(remoteJid, {
      react: { text: '⏰', key: message.key },
    });

    // instance dibuat per-request agar perubahan APIKEY langsung terpakai
    const api = new ApiAutoresbot(config.APIKEY);
    const buffer = await api.getBuffer('/api/maker/bratimage', { text, image });

    if (!isImageBuffer(buffer)) {
      throw new Error(
        readServerMessage(buffer) || 'API bratimage tidak mengembalikan gambar yang valid.',
      );
    }

    // sendImageAsSticker mendeteksi tipe file sendiri (png/jpeg/webp)
    // dan menempelkan metadata packname/author.
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

    await sock.sendMessage(remoteJid, {
      react: { text: '✅', key: message.key },
    });
  } catch (error) {
    const errorMessage = error?.serverMessage || error?.message || String(error);

    logShort('BRATIMAGE', `Error: ${errorMessage}`, error);

    await sock.sendMessage(
      remoteJid,
      { text: `❌ Gagal membuat sticker brat.\n\n${errorMessage}` },
      { quoted: message },
    );

    try {
      await sock.sendMessage(remoteJid, {
        react: { text: '❌', key: message.key },
      });
    } catch (reactionError) {
      console.warn('[BRATIMAGE] Gagal mengirim reaksi error:', reactionError.message);
    }
  }
}

export default {
  handle,
  Commands: ['bratcewek', 'bratbahlil', 'bratanime'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
