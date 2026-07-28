import { findUser, updateUser } from '../../lib/users.js';
import { sendMessageWithMention } from '../../lib/utils.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command, senderLid, senderType } = messageInfo;

  // --- Validasi input ---
  if (!content?.trim()) {
    const tex =
      `_⚠️ Format: *${prefix + command} tag 50*_\n\n` +
      `_💬 Contoh: *${prefix + command} @tag 50*_\n` +
      `_💬 Contoh: *${prefix + command} me 100*_\n\n` +
      `_me = menambahkan money ke akun Anda sendiri_`;
    return sock.sendMessage(remoteJid, { text: tex }, { quoted: message });
  }

  // Pisahkan target & jumlah money
  const [rawNumber, rawMoney] = content.split(' ').map((s) => s.trim());

  if (!rawNumber || !rawMoney) {
    return sock.sendMessage(
      remoteJid,
      {
        text: `_Masukkan format yang benar_\n\n_Contoh: *${prefix + command} @tag 50*_`,
      },
      { quoted: message },
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
      { quoted: message },
    );
  }

  // --- Tentukan target ---
  // `me` merujuk ke pengirim command (senderLid), bukan nomor bot atau owner di config.
  const targetId = rawNumber.toLowerCase() === 'me' ? senderLid : rawNumber;
  if (!targetId) {
    return sock.sendMessage(
      remoteJid,
      { text: `⚠️ _Target tidak valid, tidak bisa mengenali akun Anda._` },
      { quoted: message },
    );
  }

  // --- Ambil data user ---
  const dataUsers = await findUser(targetId);
  const userData = Array.isArray(dataUsers) ? dataUsers[1] : {};

  // --- Update data user ---
  const updated = await updateUser(targetId, {
    money: (userData.money || 0) + moneyToAdd,
  });

  if (!updated) {
    return sock.sendMessage(
      remoteJid,
      { text: `⚠️ _Pengguna dengan id ${rawNumber} tidak ditemukan._` },
      { quoted: message },
    );
  }

  // --- Kirim pesan konfirmasi ---
  await sendMessageWithMention(
    sock,
    remoteJid,
    `✅ _Money berhasil ditambahkan ${moneyToAdd}._`,
    message,
    senderType,
  );
}

export default {
  handle,
  Commands: ['addmoney'],
  OnlyPremium: false,
  OnlyOwner: true,
};
