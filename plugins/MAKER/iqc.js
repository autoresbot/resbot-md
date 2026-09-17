import ApiAutoresbotModule from 'api-autoresbot';
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import FileType from 'file-type';

import config from '../../config.js';
import mess from '../../strings.js';
import { getProfilePictureUrl } from '../../lib/cache.js';

// Fungsi untuk buat angka acak dalam range
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Waktu WIB "HH:mm" untuk jam status bar & gelembung chat. */
function getWaktuIndonesia() {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, sender, content, isQuoted, prefix, command, pushName } = messageInfo;

  /**
   * Kirim yang BOLEH gagal tanpa menggagalkan perintah.
   *
   * Penting untuk reaksi ⏰ dan pesan error: kalau sesi sedang putus, zapo
   * melempar "sendMessage requires registered meJid". Dulu error itu keluar
   * dari blok catch (saat mencoba MENGIRIM pesan errornya) sehingga lolos ke
   * processMessage dan yang terlihat di console cuma "Kesalahan di
   * processMessage: sendMessage requires registered meJid".
   */
  const kirimAman = async (isi, opsi) => {
    try {
      return await sock.sendMessage(remoteJid, isi, opsi);
    } catch (error) {
      console.log(`[IQC] Gagal mengirim: ${error?.message || error}`);
      return null;
    }
  };

  try {
    const text = content && content.trim() !== '' ? content : (isQuoted?.text ?? null);

    // Validasi input konten
    if (!text) {
      await kirimAman(
        { text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${prefix + command} resbot*_` },
        { quoted: message },
      );
      return;
    }

    // Reaksi loading — murni kosmetik, jangan sampai menggagalkan perintah.
    await kirimAman({ react: { text: '⏰', key: message.key } });

    // Foto profil: dipakai sebagai avatar di kartu chat. getProfilePictureUrl
    // sudah punya fallback sendiri (foto default) bila WhatsApp menolak atau
    // pengguna memang tidak punya foto, tapi kegagalan tak terduga di sini pun
    // tidak boleh membatalkan perintah — kartunya masih masuk akal tanpa avatar.
    let ppUser = null;
    try {
      ppUser = await getProfilePictureUrl(sock, sender);
    } catch (error) {
      console.log(`[IQC] Foto profil tidak terambil, lanjut tanpa avatar: ${error?.message}`);
    }

    const waktu = getWaktuIndonesia();

    // Buat instance API dan ambil data dari endpoint
    const api = new ApiAutoresbot(config.APIKEY);
    const buffer = await api.getBuffer('/api/maker/iqc', {
      text,
      chatTime: waktu,
      statusBarTime: waktu,
      batteryLevel: randomInt(5, 100).toString(),
      operator: 'Telkomsel 4G',
      language: 'ID', // ID & EN
      name: pushName || '',
      ...(ppUser ? { pp: ppUser } : {}),
    });

    // Server bisa membalas JSON error dengan status 200; tanpa pemeriksaan ini
    // isinya dikirim sebagai "gambar" dan WhatsApp menolaknya dengan pesan yang
    // tidak menjelaskan apa-apa.
    const tipe = buffer ? await FileType.fromBuffer(buffer) : null;
    if (!tipe?.mime?.startsWith('image/')) {
      const pesanServer = buffer ? buffer.toString('utf8').slice(0, 200) : 'balasan kosong';
      console.log(`[IQC] Balasan API bukan gambar: ${pesanServer}`);
      await kirimAman(
        { text: '_⚠️ Server sedang tidak bisa membuat gambar iqc. Coba lagi nanti._' },
        { quoted: message },
      );
      return;
    }

    await kirimAman(
      {
        image: buffer,
        caption: `${mess.general.success}`,
      },
      { quoted: message },
    );
  } catch (error) {
    console.log(error);
    await kirimAman(
      {
        text: `Maaf, terjadi kesalahan saat memproses permintaan Anda. Coba lagi nanti.\n\nError: ${error.message}`,
      },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['iqc'],
  OnlyPremium: false,
  OnlyOwner: false,
};
