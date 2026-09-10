import { findUser, updateUser } from '../../lib/users.js';
import { sendMessageWithMention } from '../../lib/utils.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command, senderLid, senderType } = messageInfo;

  // --- Validasi input ---
  if (!content?.trim()) {
    const tex =
      `_⚠️ Format: *${prefix + command} tag 30*_\n\n` +
      `_💬 Contoh: *${prefix + command} @tag 30*_\n` +
      `_💬 Contoh: *${prefix + command} me 1*_\n\n` +
      `_me = menambahkan level ke akun Anda sendiri_`;
    return sock.sendMessage(remoteJid, { text: tex }, { quoted: message });
  }

  const [rawNumber, rawLevel] = content.split(' ').map((s) => s.trim());

  if (!rawNumber || !rawLevel) {
    return sock.sendMessage(
      remoteJid,
      {
        text: `_Masukkan format yang benar_\n\n_Contoh: *${prefix + command} @tag 50*_`,
      },
      { quoted: message },
    );
  }

  const levelToAdd = parseInt(rawLevel, 10);
  if (isNaN(levelToAdd) || levelToAdd <= 0) {
    return sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ _Jumlah level harus berupa angka positif_\n\n_Contoh: *${
          prefix + command
        } username/id 5*_`,
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
  if (!dataUsers) {
    return sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ _Pengguna dengan id ${rawNumber} tidak ditemukan._`,
      },
      { quoted: message },
    );
  }

  const userData = Array.isArray(dataUsers) ? dataUsers[1] : {};

  // --- Update data user ---
  const updated = await updateUser(targetId, {
    level: (userData.level || 0) + levelToAdd,
  });

  if (!updated) {
    return sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ _Pengguna dengan id ${rawNumber} tidak ditemukan._`,
      },
      { quoted: message },
    );
  }

  // --- Kirim pesan konfirmasi ---
  await sendMessageWithMention(
    sock,
    remoteJid,
    `✅ _Level berhasil ditambahkan ${levelToAdd}._`,
    message,
    senderType,
  );
}

export default {
  handle,
  Commands: ['addlevel'],
  OnlyPremium: false,
  OnlyOwner: true,
};
