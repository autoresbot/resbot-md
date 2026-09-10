import crypto from 'node:crypto';
import { toZapoContent } from '../../lib/zapo/content.js';
import fs from 'fs';
import path from 'path';

import { downloadQuotedMedia, downloadMedia } from '../../lib/utils.js';

/**
 * Rakit isi status (Proto.IMessage) dari konten gaya Baileys.
 *
 * Baileys punya `generateWAMessageContent` yang sekaligus mengunggah media.
 * zapo TIDAK punya padanan publiknya: `status.buildMessageContent` memang ada
 * di berkas tipe, tapi tidak diekspos saat runtime — `client.status` hanya
 * berisi setPrivacy, setUserMuted, send, dan revokeStatus. Karena itu media
 * diunggah manual lalu proto-nya dirakit sendiri, sama seperti di menu.js.
 */
async function buildInnerContent(conn, content) {
  // toZapoContent menormalkan bentuknya sekaligus mengisi mimetype.
  const konten = await toZapoContent(content);

  if (konten.type === 'text') {
    return { extendedTextMessage: { text: konten.text } };
  }

  if (konten.type !== 'image' && konten.type !== 'video') {
    throw new Error(`Tipe media tidak didukung untuk status grup: ${konten.type}`);
  }

  const upload = await conn.zapo.message.upload(konten.media, {
    type: konten.type,
    mimetype: konten.mimetype,
  });

  const media = {
    url: upload.url,
    directPath: upload.directPath,
    mediaKey: upload.mediaKey,
    fileSha256: upload.fileSha256,
    fileEncSha256: upload.fileEncSha256,
    fileLength: upload.fileLength,
    mediaKeyTimestamp: upload.mediaKeyTimestamp,
    mimetype: upload.mimetype ?? konten.mimetype,
    caption: konten.caption,
  };

  return konten.type === 'image' ? { imageMessage: media } : { videoMessage: media };
}

/**
 * SEND GROUP STATUS
 */
async function groupStatus(conn, jid, content) {
  const { backgroundColor } = content;
  delete content.backgroundColor;

  const inside = await buildInnerContent(conn, content);

  if (backgroundColor && inside.extendedTextMessage) {
    inside.extendedTextMessage.backgroundArgb = backgroundColor;
  }

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

  // Caption TIDAK diubah — dibiarkan persis seperti yang diketik user.
  // Group mention cukup lewat contextInfo di bawah; sebelumnya ` @<idgrup>`
  // ikut ditempelkan ke caption dan itu mengotori teks aslinya.

  // IMAGE
  if (inside.imageMessage) {
    inside.imageMessage.contextInfo = {
      ...(inside.imageMessage.contextInfo || {}),
      ...contextInfo,
    };
  }

  // VIDEO
  if (inside.videoMessage) {
    inside.videoMessage.contextInfo = {
      ...(inside.videoMessage.contextInfo || {}),
      ...contextInfo,
    };
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
  const wrapped = {
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
  };

  // zapo mengirim Proto.IMessage mentah langsung, tanpa relayMessage terpisah.
  return await conn.sendMessage(jid, wrapped);
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
