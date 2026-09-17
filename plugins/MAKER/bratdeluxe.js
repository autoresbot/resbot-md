import ApiAutoresbotModule from 'api-autoresbot';
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from '../../config.js';
import { sendImageAsSticker } from '../../lib/exif.js';
import { logCustom } from '../../lib/logger.js';

/**
 * Varian brat yang cara pakainya persis sama, hanya beda endpoint.
 *
 * Semuanya ditaruh di satu berkas SENGAJA: kalau dipecah jadi enam berkas,
 * setiap perbaikan (mis. penanganan galat) harus disalin enam kali dan gampang
 * ketinggalan di salah satunya.
 */
const ENDPOINT = {
  bratdeluxe: '/api/maker/bratdeluxe',
  bratcomic: '/api/maker/bratcomic',
  bratbubble: '/api/maker/bratbubble',
  bratneon: '/api/maker/bratneon',
  bratword: '/api/maker/bratword',
  bratglitch: '/api/maker/bratglitch',
};

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, isQuoted, prefix, command } = messageInfo;

  try {
    const text = content && content.trim() !== '' ? content : (isQuoted?.text ?? null);

    // Validasi input konten
    if (!text) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${prefix + command} resbot*_`,
        },
        { quoted: message },
      );
      return; // Hentikan eksekusi jika tidak ada konten
    }

    // Kirimkan pesan loading dengan reaksi emoji
    await sock.sendMessage(remoteJid, {
      react: { text: '⏰', key: message.key },
    });

    // Bersihkan konten
    const sanitizedContent = text.trim().replace(/\n+/g, ' ');

    const endpoint = ENDPOINT[String(command).toLowerCase()] ?? ENDPOINT.bratdeluxe;

    // Buat instance API dan ambil data dari endpoint
    const api = new ApiAutoresbot(config.APIKEY);
    const buffer = await api.getBuffer(endpoint, {
      text: sanitizedContent,
    });
    const options = {
      packname: config.sticker_packname,
      author: config.sticker_author,
    };

    // Kirim stiker
    await sendImageAsSticker(sock, remoteJid, buffer, options, message);
  } catch (error) {
    logCustom('info', content, `ERROR-COMMAND-${command}.txt`);

    // Endpoint yang belum tersedia di server dibalas 404. Tanpa penjelasan ini
    // pengguna cuma melihat "Not Found: Endpoint not found." dan mengira
    // perintahnya salah ketik.
    const errorMessage = /not found/i.test(error.message || '')
      ? `Maaf, fitur *${prefix + command}* belum tersedia di server. Coba varian lain seperti *${prefix}bratdeluxe*.`
      : `Maaf, terjadi kesalahan saat memproses permintaan Anda. Coba lagi nanti.\n\nError: ${error.message}`;

    await sock.sendMessage(
      remoteJid,
      {
        text: errorMessage,
      },
      { quoted: message },
    );
  }
}
export default {
  handle,
  Commands: Object.keys(ENDPOINT),
  // Keenamnya fitur BERBEDA (beda gaya gambar), bukan alias satu sama lain,
  // jadi semuanya harus tampil di menu.
  MenuCommands: 'all',
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
