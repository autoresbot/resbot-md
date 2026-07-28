import { downloadQuotedMedia, downloadMedia, reply } from '../../lib/utils.js';
import { uploadImageFile, logShort } from '../../lib/uploader.js';
import fs from 'fs-extra';
import path from 'path';

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, isQuoted, type, content, prefix, command } = messageInfo;
  try {
    const mediaType = isQuoted ? isQuoted.type : type;
    if (mediaType !== 'image' && mediaType !== 'sticker') {
      return await reply(m, `⚠️ _Kirim/Balas gambar/sticker dengan caption *${prefix + command}*_`);
    }

    // Tampilkan reaksi "Loading"
    await sock.sendMessage(remoteJid, {
      react: { text: '⏰', key: message.key },
    });

    // Download & Upload media
    const media = isQuoted ? await downloadQuotedMedia(message) : await downloadMedia(message);
    const mediaPath = path.join('tmp', media);

    if (!fs.existsSync(mediaPath)) {
      throw new Error('File media tidak ditemukan setelah diunduh.');
    }

    // convert: false — fitur ini menghasilkan URL dari file yang dikirim user,
    // jadi isi file HARUS dipertahankan apa adanya (sticker tetap WebP).
    // Yang dibetulkan hanya nama file & content-type agar cocok dengan isi
    // sebenarnya; tanpa itu, gambar ber-isi WebP yang oleh WhatsApp diberi
    // ekstensi .jpg akan ditolak server dengan pesan
    // "Isi file tidak sesuai dengan format yang diizinkan."
    //
    // uploadImageFile MELEMPAR error saat gagal (bukan mengembalikan false),
    // sehingga penyebabnya tidak lagi tertutupi. Versi lama mengembalikan
    // `false` lalu baris di bawah membaca `result.data.url` sehingga muncul
    // TypeError yang menyembunyikan error asli dari server.
    const url = await uploadImageFile(mediaPath, {
      convert: false,
      label: 'TOURL',
    });

    await reply(
      m,
      `_✅ Upload sukses!_
📎 *Link*: ${url}

_File ini akan otomatis kadaluarsa 1 minggu setelah diunggah. Namun, jika file diakses lagi sebelum kadaluarsa, masa aktifnya akan otomatis diperpanjang 1 minggu ke depan._`,
    );
  } catch (error) {
    // Satu baris ringkas di console; detail lengkap masuk logs/api.log.
    // (Label sebelumnya tertulis "translation handler" — salin-tempel dari translate.js.)
    logShort('TOURL', `Error: ${error?.serverMessage || error?.message || error}`, error);
    await sock.sendMessage(
      remoteJid,
      { text: 'Maaf, terjadi kesalahan. Coba lagi nanti!' },
      { quoted: message },
    );
  }
}
export default {
  handle,
  Commands: ['tourl'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
