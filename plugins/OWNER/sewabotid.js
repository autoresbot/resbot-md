import { addSewa, findSewa } from "../../lib/sewa.js";
import config from "../../config.js";
import { selisihHari, hariini } from "../../lib/utils.js";
import { deleteCache } from "../../lib/globalCache.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, sender, prefix, command } = messageInfo;

  // Validasi input kosong atau tidak sesuai format
  if (!content || content.trim() === "") {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
          prefix + command
        } xxxx@g.us 30*_\n\n_*30* artinya 30 hari, bot otomatis akan keluar apabila waktu habis_\n\n_Jika Bot Sudah Bergabung ke Grup Sewa dan untuk perpanjang silakan ketik *.tambahsewa*_`,
      },
      { quoted: message }
    );
  }

  // Split content menjadi array untuk memisahkan link dan jumlah hari
  const args = content.trim().split(" ");
  if (args.length < 2) {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ Format tidak valid. Contoh penggunaan:\n\n_*${
          prefix + command
        } xxx@g.us 30*_`,
      },
      { quoted: message }
    );
  }

  const linkGrub = args[0]; // Ambil link grup
  const totalHari = parseInt(args[1], 10); // Konversi hari menjadi angka

  // Validasi link grup
  if (!linkGrub.includes("@g.us")) {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ ID grup harus mengandung '@g.us'. Contoh penggunaan:\n\n_*${
          prefix + command
        } xxx@g.us 30*_`,
      },
      { quoted: message }
    );
  }

  // Validasi jumlah hari
  if (isNaN(totalHari) || totalHari <= 0) {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ Jumlah hari tidak valid. Contoh penggunaan:\n\n_*${
          prefix + command
        } xxx@g.us 30*_`,
      },
      { quoted: message }
    );
  }

  const currentDate = new Date();
  const expirationDate = new Date(
    currentDate.getTime() + totalHari * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000
  );
  const timestampExpiration = expirationDate.getTime();

  try {
    // Proses penambahan sewa ke database
    await addSewa(linkGrub, {
      linkGrub: linkGrub,
      start: hariini,
      expired: timestampExpiration,
    });

    deleteCache(`sewa-${remoteJid}`); // reset cache

    // Kirim pesan berhasil
    return await sock.sendMessage(
      remoteJid,
      {
        text:
          `_*Bot Sudah Bergabung*_` +
          `\nNomor Bot : ${config.phone_number_bot}` +
          `\nExpired : *${selisihHari(timestampExpiration)}*` +
          `\n\n_Untuk Mengecek status sewa ketik *.ceksewa* pada grub tersebut_`,
      },
      { quoted: message }
    );
  } catch (error) {
    console.log(error);

    // Pesan error default
    let info = "_Pastikan link grup valid._";

    // Periksa pesan error
    if (error instanceof Error && error.message.includes("not-authorized")) {
      info = `_Kemungkinan Anda pernah dikeluarkan dari grup. Solusi: undang bot kembali atau masukkan secara manual._`;
    }

    // Kirim pesan error ke pengguna
    return await sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ _Gagal bergabung ke grup._\n\n${info}`,
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["sewabotid"],
  OnlyPremium: false,
  OnlyOwner: true,
};
