import crypto from 'node:crypto';
import * as baileys from 'baileys';
import fs from 'fs';
import path from 'path';

import { downloadQuotedMedia, downloadMedia } from '../../lib/utils.js';

/**
 * SEND GROUP STATUS
 */
async function groupStatus(conn, jid, content) {
  const { backgroundColor } = content;
  delete content.backgroundColor;

  // Generate WA Message Content
  const inside = await baileys.generateWAMessageContent(content, {
    upload: conn.waUploadToServer,
    backgroundColor,
  });

  /**
   * FIX GROUP MENTION
   * WA terbaru membaca group mention dari contextInfo
   */

  const contextInfo = {
    groupMentions: [
      {
        groupJid: jid,
        groupSubject: 'Group',
      },
    ],
    mentionedJid: [jid],
  };

  // IMAGE
  if (inside.imageMessage) {
    inside.imageMessage.contextInfo = {
      ...(inside.imageMessage.contextInfo || {}),
      ...contextInfo,
    };

    // paksa mention ke caption
    inside.imageMessage.caption = (inside.imageMessage.caption || '') + ` @${jid.split('@')[0]}`;
  }

  // VIDEO
  if (inside.videoMessage) {
    inside.videoMessage.contextInfo = {
      ...(inside.videoMessage.contextInfo || {}),
      ...contextInfo,
    };

    inside.videoMessage.caption = (inside.videoMessage.caption || '') + ` @${jid.split('@')[0]}`;
  }

  // TEXT
  if (inside.extendedTextMessage) {
    inside.extendedTextMessage.contextInfo = {
      ...(inside.extendedTextMessage.contextInfo || {}),
      ...contextInfo,
    };
  }

  const messageSecret = crypto.randomBytes(32);

  // Generate wrapper
  const m = baileys.generateWAMessageFromContent(
    jid,
    {
      messageContextInfo: {
        messageSecret,
      },

      groupStatusMessageV2: {
        message: {
          ...inside,

          messageContextInfo: {
            messageSecret,
          },
        },
      },
    },
    {},
  );

  // Relay
  await conn.relayMessage(jid, m.message, {
    messageId: m.key.id,
  });

  return m;
}

/**
 * COMMAND HANDLER
 */
async function handle(sock, messageInfo) {
  const { remoteJid, message, content, type, isQuoted, prefix, command } = messageInfo;

  try {
    /**
     * GET MEDIA
     */
    const mediaFile = isQuoted ? await downloadQuotedMedia(message) : await downloadMedia(message);

    const caption = content?.trim() || isQuoted?.content?.caption || '';

    /**
     * VALIDATION
     */
    if (!mediaFile && !caption) {
      return await sock.sendMessage(
        remoteJid,
        {
          text:
            `⚠️ *Format Salah*\n\n` +
            `Contoh:\n` +
            `${prefix + command} teks\n` +
            `atau reply gambar/video`,
        },
        {
          quoted: message,
        },
      );
    }

    let payload = {};

    /**
     * MEDIA MODE
     */
    if (mediaFile) {
      const mediaPath = path.join('tmp', mediaFile);

      if (!fs.existsSync(mediaPath)) {
        throw new Error(`Media tidak ditemukan: ${mediaPath}`);
      }

      const buffer = fs.readFileSync(mediaPath);

      let mediaType = type;

      // fallback detection
      if (mediaType !== 'image' && mediaType !== 'video') {
        const ext = path.extname(mediaFile).toLowerCase();

        const imageExts = ['.jpg', '.jpeg', '.png', '.webp'];

        const videoExts = ['.mp4', '.mov', '.mkv', '.webm', '.avi'];

        if (imageExts.includes(ext)) {
          mediaType = 'image';
        } else if (videoExts.includes(ext)) {
          mediaType = 'video';
        }
      }

      /**
       * IMAGE
       */
      if (mediaType === 'image') {
        payload = {
          image: buffer,

          caption: caption || ' ',

          mentions: [remoteJid],

          groupMentions: [
            {
              groupJid: remoteJid,
              groupSubject: 'Group',
            },
          ],
        };
      } else if (mediaType === 'video') {
        /**
         * VIDEO
         */
        payload = {
          video: buffer,

          caption: caption || ' ',

          mentions: [remoteJid],

          groupMentions: [
            {
              groupJid: remoteJid,
              groupSubject: 'Group',
            },
          ],
        };
      } else {
        /**
         * UNSUPPORTED
         */
        throw new Error('Tipe media tidak didukung untuk status grup');
      }
    } else {
      /**
       * TEXT ONLY
       */
      payload = {
        text: caption,

        mentions: [remoteJid],

        groupMentions: [
          {
            groupJid: remoteJid,
            groupSubject: 'Group',
          },
        ],
      };
    }

    /**
     * SEND
     */
    await groupStatus(sock, remoteJid, payload);

    /**
     * SUCCESS
     */
    await sock.sendMessage(
      remoteJid,
      {
        text: '✅ Status grup berhasil dikirim',
      },
      {
        quoted: message,
      },
    );
  } catch (err) {
    console.error('[UPS WGC ERROR]', err);

    await sock.sendMessage(
      remoteJid,
      {
        text: `❌ Gagal mengirim status grup\n\n${err.message}`,
      },
      {
        quoted: message,
      },
    );
  }
}

export default {
  handle,

  Commands: ['upswgc', 'swgc'],

  OnlyOwner: true,
  OnlyPremium: false,
};
