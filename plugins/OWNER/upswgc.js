import * as baileys from 'baileys';
import crypto from 'node:crypto';
import fs from 'fs';

import { downloadQuotedMedia, downloadMedia } from '../../lib/utils.js';

/**
 * Kirim Status Grup (Story dengan tag grup)
 */
async function groupStatus(sock, jid, content) {
  const { backgroundColor } = content;
  delete content.backgroundColor;

  const inside = await baileys.generateWAMessageContent(content, {
    upload: sock.waUploadToServer,
    backgroundColor,
  });

  const messageSecret = crypto.randomBytes(32);

  const msg = baileys.generateWAMessageFromContent(
    jid,
    {
      messageContextInfo: { messageSecret },
      groupStatusMessageV2: {
        message: {
          ...inside,
          messageContextInfo: { messageSecret },
        },
      },
    },
    {},
  );

  await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
  return msg;
}

/**
 * Handler Command
 */
async function handle(sock, messageInfo) {
  const { remoteJid, message, content, type, isQuoted, prefix, command } = messageInfo;

  try {
    // Ambil media jika ada
    const mediaFile = isQuoted ? await downloadQuotedMedia(message) : await downloadMedia(message);

    const caption = content?.trim() || isQuoted?.content?.caption || '';

    // Validasi input kosong
    if (!mediaFile && !caption) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ *Format Salah*\n\nContoh:\n${prefix + command} teks\natau reply gambar/video`,
        },
        { quoted: message },
      );
    }

    let payload = {};

    // Jika ada media
    if (mediaFile) {
      const mediaPath = `tmp/${mediaFile}`;

      if (!fs.existsSync(mediaPath)) {
        throw new Error(`Media tidak ditemukan: ${mediaPath}`);
      }

      const buffer = fs.readFileSync(mediaPath);

      // Tentukan tipe media
      if (type === 'image') {
        payload = {
          image: buffer,
          caption,
        };
      } else if (type === 'video') {
        payload = {
          video: buffer,
          caption,
        };
      } else {
        throw new Error('Tipe media tidak didukung untuk status grup');
      }
    } else {
      // Text only
      payload = { text: caption };
    }

    // Kirim Status Grup
    await groupStatus(sock, remoteJid, payload);

    await sock.sendMessage(
      remoteJid,
      { text: '✅ Status grup berhasil dikirim' },
      { quoted: message },
    );
  } catch (err) {
    console.error('[UPS WGC ERROR]', err);
    await sock.sendMessage(
      remoteJid,
      { text: '❌ Gagal mengirim status grup' },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['upswgc', 'swgc'],
  OnlyOwner: true,
  OnlyPremium: false,
};
