import crypto from 'node:crypto';
import * as baileys from 'baileys';
import fs from 'fs';
import path from 'path';

import { downloadQuotedMedia, downloadMedia } from '../../lib/utils.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, type, isQuoted, prefix, command } = messageInfo;

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
    const mediaPath = path.join('tmp', mediaFile);

    if (!fs.existsSync(mediaPath)) {
      throw new Error(`Media tidak ditemukan: ${mediaPath}`);
    }

    const buffer = fs.readFileSync(mediaPath);

    /**
     * AMBIL QUOTED MESSAGE (SUPER SAFE)
     */
    const quoted = message?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    // message.message.extendedTextMessage.contextInfo.quotedMessage.documentWithCaptionMessage.message.documentMessage.mimetype

    const doc =
      quoted?.documentMessage ||
      quoted?.documentWithCaptionMessage?.message?.documentMessage ||
      quoted?.documentWithCaptionMessage?.message?.message?.documentMessage;

    const mimeType = doc?.mimetype || '';
    /**
     * VALIDASI FINAL
     */
    if (!mimeType) {
      throw new Error('Mimetype tidak ditemukan dari document');
    }

    /**
     * AUTO RESEND BERDASARKAN MIME TYPE
     */
    if (mimeType.startsWith('video/')) {
      await sock.sendMessage(
        remoteJid,
        {
          video: buffer,
          caption: content || '',
        },
        { quoted: message },
      );
    } else if (mimeType.startsWith('image/')) {
      await sock.sendMessage(
        remoteJid,
        {
          image: buffer,
          caption: content || '',
        },
        { quoted: message },
      );
    } else {
      throw new Error(`Tipe tidak didukung: ${mimeType}`);
    }

    // optional cleanup
    fs.unlink(mediaPath, () => {});
  } catch (err) {
    console.error('[SWHD WGC ERROR]', err);

    await sock.sendMessage(
      remoteJid,
      {
        text: `❌ Gagal convert document\n\n${err.message}`,
      },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['swhd'],
  OnlyOwner: true,
  OnlyPremium: false,
};
