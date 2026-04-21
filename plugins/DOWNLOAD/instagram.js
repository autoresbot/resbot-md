import { igdl } from 'btch-downloader';
import mess from '../../strings.js';
import { logCustom } from '../../lib/logger.js';
import { downloadToBuffer } from '../../lib/utils.js';
import ApiAutoresbotModule from 'api-autoresbot';
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from '../../config.js';

/* ===================== UTILS ===================== */

const isIGUrl = (url = '') => /instagram\.com/i.test(url);

const sendText = (sock, jid, message, text) => sock.sendMessage(jid, { text }, { quoted: message });

const reactLoading = (sock, jid, message) =>
  sock.sendMessage(jid, {
    react: { text: '⏰', key: message.key },
  });

const detectType = (url = '') => {
  const ext = url.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? 'image' : 'video';
};

const sendMedia = async (sock, jid, message, buffer, type) => {
  const payload =
    type === 'image'
      ? { image: buffer, caption: mess.general.success }
      : { video: buffer, caption: mess.general.success };

  return sock.sendMessage(jid, payload, { quoted: message });
};

/* ===================== CORE ===================== */

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;

  if (!content?.trim() || !isIGUrl(content)) {
    return sendText(
      sock,
      remoteJid,
      message,
      `_⚠️ Format Penggunaan:_\n\n_💬 Contoh:_ *${
        prefix + command
      } https://www.instagram.com/xxx*_`,
    );
  }

  await reactLoading(sock, remoteJid, message);

  try {
    /* ===== PRIMARY (igdl) ===== */
    const res = await igdl(content);

    if (!res?.length) throw new Error('Media tidak ditemukan dari igdl');

    const mediaUrl = res[0]?.url;
    const type = detectType(mediaUrl);
    const buffer = await downloadToBuffer(mediaUrl, 'jpg');

    return await sendMedia(sock, remoteJid, message, buffer, type);
  } catch (error) {
    console.warn('IGDL gagal, pakai fallback API...');

    try {
      /* ===== FALLBACK API ===== */
      const api = new ApiAutoresbot(config.APIKEY);

      const res = await api.get('/api/downloader/instagram', {
        url: content,
      });

      if (!res || res.code !== 200 || !res.data) {
        throw new Error('Fallback tidak mengembalikan data valid');
      }

      const mediaUrl = res.data;
      const type = detectType(mediaUrl);
      const buffer = await downloadToBuffer(mediaUrl, 'jpg');

      return await sendMedia(sock, remoteJid, message, buffer, type);
    } catch (fallbackError) {
      console.error('Fallback error:', fallbackError);

      logCustom('info', content, `ERROR-COMMAND-${command}.txt`);

      return sendText(
        sock,
        remoteJid,
        message,
        `Maaf, terjadi kesalahan.\n\n*Detail:* ${fallbackError.message || 'Unknown error'}`,
      );
    }
  }
}

/* ===================== EXPORT ===================== */

export default {
  handle,
  Commands: ['ig', 'instagram'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
