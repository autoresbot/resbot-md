import { findUser, updateUser } from "../../lib/users.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, sender, prefix, command } = messageInfo;

  // Validasi input kosong
  if (!content || content.trim() === "") {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
          prefix + command
        } 50*_\n\n_Ket : *1* limit = *20* money_`,
      },
      { quoted: message }
    );
  }

  // Pastikan `content` hanya angka
  const limitToBuy = parseInt(content.trim(), 10);
  if (isNaN(limitToBuy) || limitToBuy <= 0) {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ _Jumlah limit harus berupa angka positif_\n\n_Contoh: *buylimit 50*_`,
      },
      { quoted: message }
    );
  }

  // Harga per limit
  const pricePerLimit = 20;
  const totalCost = limitToBuy * pricePerLimit;

  // Ambil data user
  const dataUsers = findUser(sender);

  if (!dataUsers) return;

  const [docId, userData] = dataUsers;

  // Validasi apakah user memiliki cukup saldo
  if (userData.money < totalCost) {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ _Saldo Anda tidak cukup untuk membeli *${limitToBuy}* limit._\n\n_Harga total:_ ${totalCost} money\n_Saldo Anda:_ ${userData.money} money`,
      },
      { quoted: message }
    );
  }

  // Update data pengguna
  updateUser(sender, {
    limit: userData.limit + limitToBuy, // Tambah limit
    money: userData.money - totalCost, // Kurangi saldo
  });

  // Kirim pesan berhasil
  return await sock.sendMessage(
    remoteJid,
    {
      text: `✅ _Pembelian limit berhasil! 🎉_\n\n_Limit Anda bertambah: *${limitToBuy}*_\n_Saldo Anda:_ ${
        userData.money - totalCost
      } money`,
    },
    { quoted: message }
  );
}

export default {
  handle,
  Commands: ["buylimit"],
  OnlyPremium: false,
  OnlyOwner: false,
};
