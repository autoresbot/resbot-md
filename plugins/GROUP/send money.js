import { findUser, updateUser } from "../../lib/users.js";
import { sendMessageWithMention, convertToJid } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, sender, command, prefix } = messageInfo;

  // Validasi input kosong
  if (!content || content.trim() === "") {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ _Masukkan format yang valid_\n\n_Contoh: *${
          prefix + command
        } @tag 50*_`,
      },
      { quoted: message }
    );
  }

  try {
    // Pisahkan konten
    const args = content.trim().split(/\s+/);
    if (args.length < 2) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ _Format tidak valid. Contoh:_ *${
            prefix + command
          } @tag 50*`,
        },
        { quoted: message }
      );
    }

    const target = args[0]; // Nomor penerima atau tag
    const r = await convertToJid(sock, target);
      if(!r) {
       return await sock.sendMessage(
        remoteJid,
        { text: `⚠️ _User tidak ditemukan, pastikan target sudah chat di grub ini_` },
        { quoted: message }
      );
    }
    const moneyToSend = parseInt(args[1], 10);

    // Validasi jumlah money
    if (isNaN(moneyToSend) || moneyToSend <= 0) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ _Jumlah money harus berupa angka positif_\n\n_Contoh: *${
            prefix + command
          } @tag 50*_`,
        },
        { quoted: message }
      );
    }

    // Fungsi helper: ekstrak hanya nomor
    function extractNumber(input) {
      input = input
        .trim()
        .replace(/^@/, "") // hapus awalan @
        .replace(/@s\.whatsapp\.net$/, ""); // hapus akhiran @s.whatsapp.net

      // Ambil hanya angka
      const number = input.replace(/[^0-9]/g, "");

      // Kalau hasilnya tidak ada angka sama sekali, kembalikan null atau ""
      return number.length > 0 ? number : null;
    }

    // Ambil nomor murni target & sender
    const targetNumber = extractNumber(r);
    const senderNumber = extractNumber(sender);

    // Validasi: Tidak bisa mengirim ke diri sendiri
    if (targetNumber === senderNumber) {
      return await sock.sendMessage(
        remoteJid,
        { text: `⚠️ _Anda tidak bisa mengirim money ke nomor Anda sendiri._` },
        { quoted: message }
      );
    }

    // Ambil data pengguna pengirim
    const senderData = await findUser(sender);
    if (!senderData) {
      return await sock.sendMessage(
        remoteJid,
        { text: `⚠️ _Pengguna dengan nomor/tag tersebut tidak ditemukan._` },
        { quoted: message }
      );
    }

    const [docId1, userData1] = senderData;

    // Validasi apakah pengirim memiliki cukup money
    if (userData1.money < moneyToSend) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ _Money Anda tidak cukup untuk mengirim ${moneyToSend} money._`,
        },
        { quoted: message }
      );
    }

    // Ambil data penerima
    const receiverData = await findUser(targetNumber);

    if (!receiverData) {
      return await sock.sendMessage(
        remoteJid,
        { text: `⚠️ _Pengguna dengan nomor/tag tersebut tidak ditemukan._` },
        { quoted: message }
      );
    }

    const [docId2, userData2] = receiverData;

    // Update money pengguna pengirim dan penerima
    await updateUser(sender, { money: userData1.money - moneyToSend });
    await updateUser(targetNumber, { money: userData2.money + moneyToSend });

    // Kirim pesan berhasil
    return await sock.sendMessage(
      remoteJid,
      {
        text: `✅ _Berhasil mengirim ${moneyToSend} money ke ${targetNumber}._\n\nKetik *.me* untuk melihat detail akun Anda.`,
      },
      { quoted: message }
    );
  } catch (error) {
    console.error("Terjadi kesalahan:", error);

    // Kirim pesan error
    return await sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.`,
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["sendmoney"],
  OnlyPremium: false,
  OnlyOwner: false,
};
