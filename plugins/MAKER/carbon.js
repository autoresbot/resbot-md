import ApiAutoresbotModule from 'api-autoresbot';
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from '../../config.js';
import mess from '../../strings.js';
import { logCustom } from '../../lib/logger.js';

/** Batas dari sisi API: lebih dari ini dibalas "terlalu panjang". */
const MAKS_KARAKTER = 3000;

/**
 * API membalas galat memakai status HTTP 200 dengan badan JSON, bukan gambar.
 * Tanpa pemeriksaan ini JSON-nya ikut terkirim sebagai gambar dan ditolak
 * WhatsApp tanpa penjelasan apa pun ke pengguna.
 *
 * @returns {string|null} pesan galat dari API, atau null bila balasannya gambar
 */
function bacaGalatApi(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return 'Balasan API kosong';
  if (buffer[0] !== 0x7b) return null; // bukan diawali '{' -> anggap gambar

  try {
    const data = JSON.parse(buffer.toString('utf8'));
    return data?.message || 'API menolak permintaan';
  } catch {
    return null;
  }
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, isQuoted, prefix, command } = messageInfo;

  try {
    // Baris baru dan indentasi SENGAJA dipertahankan — isinya biasanya
    // potongan kode, dan tanpa itu susunannya hancur di gambar.
    const teks = content && content.trim() !== '' ? content : (isQuoted?.text ?? null);

    if (!teks || !teks.trim()) {
      await sock.sendMessage(
        remoteJid,
        {
          text:
            `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${prefix + command} console.log('halo')*_` +
            `\n\n_Bisa juga dengan membalas sebuah pesan berisi kode._`,
        },
        { quoted: message },
      );
      return;
    }

    if (teks.length > MAKS_KARAKTER) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Teks terlalu panjang (${teks.length} karakter)._\n\n_Maksimal *${MAKS_KARAKTER}* karakter._`,
        },
        { quoted: message },
      );
      return;
    }

    await sock.sendMessage(remoteJid, {
      react: { text: '⏰', key: message.key },
    });

    const api = new ApiAutoresbot(config.APIKEY);
    // Di-encode karena server men-decode teksnya sekali lagi — tanpa ini kode
    // yang memuat "%" (mis. printf("%d")) bisa berubah.
    const buffer = await api.getBuffer('/api/maker/carbon', {
      text: encodeURIComponent(teks),
    });

    const galat = bacaGalatApi(buffer);
    if (galat) throw new Error(galat);

    await sock.sendMessage(
      remoteJid,
      { image: buffer, caption: mess.general.success },
      { quoted: message },
    );
  } catch (error) {
    console.error('Kesalahan di fungsi handle:', error);
    logCustom('info', content, `ERROR-COMMAND-${command}.txt`);

    const errorMessage = error.message || 'Terjadi kesalahan tak dikenal.';
    await sock.sendMessage(
      remoteJid,
      { text: `_Error: ${errorMessage}_` },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['carbon'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
