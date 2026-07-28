import fs from 'fs';
import path from 'path';

import {
  downloadQuotedMedia,
  downloadMedia,
  getContextInfo,
  extractMedia,
} from '../../lib/utils.js';

/**
 * Tentukan bentuk asli media.
 *
 * Kalau media memang sudah bukan document (mis. reply ke audio/gambar langsung),
 * pakai jenisnya apa adanya. Kalau berupa document, bentuk aslinya ditebak dari
 * mimetype — inilah kasus utama fitur ini: file yang dikirim sebagai document
 * dikembalikan menjadi media yang bisa diputar/dilihat.
 */
function detectKind(mediaType, mimeType) {
  if (mediaType && mediaType !== 'document') return mediaType;
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'image/webp') return 'sticker'; // webp hampir selalu sticker
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  return null;
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, isQuoted, prefix, command } = messageInfo;

  let mediaPath = null;

  try {
    const mediaFile = isQuoted ? await downloadQuotedMedia(message) : await downloadMedia(message);

    /**
     * VALIDATION
     */
    if (!mediaFile) {
      return await sock.sendMessage(
        remoteJid,
        {
          text:
            `⚠️ *Format Salah*\n\n` +
            `Contoh:\n` +
            `reply document video/image dengan caption ${prefix}${command} [caption]`,
        },
        { quoted: message },
      );
    }

    await sock.sendMessage(remoteJid, {
      react: { text: '⏰', key: message.key },
    });

    /**
     * MEDIA MODE
     */
    mediaPath = path.join('tmp', mediaFile);

    if (!fs.existsSync(mediaPath)) {
      throw new Error(`Media tidak ditemukan: ${mediaPath}`);
    }

    const buffer = fs.readFileSync(mediaPath);

    /**
     * AMBIL INFO MEDIA
     *
     * Pakai helper yang sama dengan downloader (getContextInfo + extractMedia)
     * supaya mimetype selalu berasal dari media yang benar-benar didownload.
     * Helper ini juga sudah membuka wrapper ephemeral/viewOnce/documentWithCaption
     * dan membaca contextInfo dari tipe pesan apa pun, bukan cuma extendedTextMessage.
     */
    const source = isQuoted ? getContextInfo(message)?.quotedMessage : message;
    const media = extractMedia(source);

    const mimeType = media?.mediaMessage?.mimetype || '';

    /**
     * VALIDASI FINAL
     */
    if (!mimeType) {
      throw new Error('Mimetype tidak ditemukan dari document');
    }

    /**
     * AUTO RESEND BERDASARKAN BENTUK ASLI
     */
    const kind = detectKind(media?.mediaType, mimeType);
    const caption = content || '';

    if (kind === 'video') {
      await sock.sendMessage(remoteJid, { video: buffer, caption }, { quoted: message });
    } else if (kind === 'image') {
      await sock.sendMessage(remoteJid, { image: buffer, caption }, { quoted: message });
    } else if (kind === 'sticker') {
      await sock.sendMessage(remoteJid, { sticker: buffer }, { quoted: message });
    } else if (kind === 'audio') {
      // WhatsApp memakai ogg/opus khusus untuk voice note, format lain (mp3, m4a)
      // dikirim sebagai audio biasa. Audio tidak mendukung caption.
      const isVoiceNote = /ogg|opus/i.test(mimeType);
      await sock.sendMessage(
        remoteJid,
        { audio: buffer, mimetype: mimeType, ptt: isVoiceNote },
        { quoted: message },
      );
    } else {
      throw new Error(`Tipe tidak didukung: ${mimeType}`);
    }
  } catch (err) {
    console.error('[SWHD WGC ERROR]', err);

    await sock.sendMessage(
      remoteJid,
      {
        text: `❌ Gagal convert document\n\n${err.message}`,
      },
      { quoted: message },
    );
  } finally {
    // Bersihkan file sementara, termasuk saat konversi gagal di tengah jalan
    if (mediaPath) fs.unlink(mediaPath, () => {});
  }
}

export default {
  handle,
  Commands: ['swhd'],
  OnlyOwner: false,
  OnlyPremium: false,
};
