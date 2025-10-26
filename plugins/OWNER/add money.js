import { findUser, updateUser } from "../../lib/users.js";
import { sendMessageWithMention, convertToJid } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command, senderType } =
    messageInfo;

    

  // --- Validasi input ---
  if (!content?.trim()) {
    const tex =
      `_⚠️ Format: *${prefix + command} tag 50*_\n\n` +
      `_💬 Contoh: *${prefix + command} @tag 50*_`;
    return sock.sendMessage(remoteJid, { text: tex }, { quoted: message });
  }

  // Pisahkan target & jumlah money
  const [rawNumber, rawMoney] = content.split(" ").map((s) => s.trim());

  if (!rawNumber || !rawMoney) {
    return sock.sendMessage(
      remoteJid,
      {
        text: `_Masukkan format yang benar_\n\n_Contoh: *${
          prefix + command
        } @tag 50*_`,
      },
      { quoted: message }
    );
  }

  // Validasi jumlah money
  const moneyToAdd = parseInt(rawMoney, 10);
  if (isNaN(moneyToAdd) || moneyToAdd <= 0) {
    return sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ _Jumlah money harus berupa angka positif_\n\n_Contoh: *${
          prefix + command
        } @tag 50*_`,
      },
      { quoted: message }
    );
  }

  // --- Ambil data user ---
  const r = await convertToJid(sock, rawNumber)
  const dataUsers = await findUser(r);
  if (!dataUsers) {
    return sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ _Pengguna dengan id ${r} tidak ditemukan._`,
      },
      { quoted: message }
    );
  }

  const [docId, userData] = dataUsers;

  // --- Update data user ---
  await updateUser(r, {
    money: (userData.money || 0) + moneyToAdd,
  });

  // --- Kirim pesan konfirmasi ---
  await sendMessageWithMention(
    sock,
    remoteJid,
    `✅ _Money berhasil ditambahkan ${moneyToAdd}._`,
    message,
    senderType
  );
}

export default {
  handle,
  Commands: ["addmoney"],
  OnlyPremium: false,
  OnlyOwner: true,
};
