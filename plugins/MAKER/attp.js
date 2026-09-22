import ApiAutoresbotModule from 'api-autoresbot';
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from '../../config.js';
import { sendImageAsSticker } from '../../lib/exif.js';
import { logCustom } from '../../lib/logger.js';

/**
 * Tiap perintah memanggil endpoint dengan nama yang SAMA.
 *
 * Dulu .attp memanggil /attp2 dan .attp2 memanggil /attp3, sementara /attp
 * dan .attp3 tidak terpakai. Semuanya disatukan di berkas ini (pola yang sama
 * dengan bratdeluxe.js) supaya perbaikan cukup dilakukan sekali.
 */
const ENDPOINT = {
  attp: '/api/maker/attp', // GIF
  attp2: '/api/maker/attp2', // webp animasi
  attp3: '/api/maker/attp3', // webp animasi
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

    const endpoint = ENDPOINT[String(command).toLowerCase()] ?? ENDPOINT.attp;

    // Buat instance API dan ambil data dari endpoint. Teks di-encode karena
    // server men-decode-nya sekali lagi — tanpa ini teks seperti "%41" berubah.
    const api = new ApiAutoresbot(config.APIKEY);
    const buffer = await api.getBuffer(endpoint, { text: encodeURIComponent(text.trim()) });

    const options = {
      packname: config.sticker_packname,
      author: config.sticker_author,
    };

    // Lewat sendImageAsSticker, bukan dikirim mentah: /attp mengembalikan GIF
    // yang harus dikonversi dulu, dan jalur ini juga menambahkan nama paket
    // stiker serta ukuran standar 512x512.
    await sendImageAsSticker(sock, remoteJid, buffer, options, message);
  } catch (error) {
    logCustom('info', content, `ERROR-COMMAND-${command}.txt`);

    // Tangani kesalahan dan kirimkan pesan error ke pengguna
    const errorMessage = `Maaf, terjadi kesalahan saat memproses permintaan Anda. Coba lagi nanti.\n\nError: ${error.message}`;
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
  // Ketiganya gaya yang berbeda, bukan alias, jadi semuanya tampil di menu.
  MenuCommands: 'all',
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
