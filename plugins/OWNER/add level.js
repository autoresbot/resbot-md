const { findUser, updateUser } = require("@lib/users");
const { sendMessageWithMention } = require("@lib/utils");

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command, senderType } =
    messageInfo;

  // --- Validasi input ---
  if (!content?.trim()) {
    const tex =
      `_⚠️ Format: *${prefix + command} username/id 30*_\n\n` +
      `_💬 Contoh: *${prefix + command} azharicreative 30*_`;
    return sock.sendMessage(remoteJid, { text: tex }, { quoted: message });
  }

  const [rawNumber, rawLevel] = content.split(" ").map((s) => s.trim());

  if (!rawNumber || !rawLevel) {
    return sock.sendMessage(
      remoteJid,
      {
        text: `_Masukkan format yang benar_\n\n_Contoh: *${
          prefix + command
        } azharicreative 50*_`,
      },
      { quoted: message }
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
      { quoted: message }
    );
  }

  // --- Ambil data user ---
  const dataUsers = await findUser(rawNumber);
  if (!dataUsers) {
    return sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ _Pengguna dengan username/id ${rawNumber} tidak ditemukan._`,
      },
      { quoted: message }
    );
  }

  const [docId, userData] = dataUsers;

  // --- Update data user ---
  await updateUser(rawNumber, {
    level: (userData.level || 0) + levelToAdd,
  });

  // --- Kirim pesan konfirmasi ---
  await sendMessageWithMention(
    sock,
    remoteJid,
    `✅ _Level berhasil ditambah ${levelToAdd} untuk username/id ${rawNumber}._`,
    message,
    senderType
  );
}

module.exports = {
  handle,
  Commands: ["addlevel"],
  OnlyPremium: false,
  OnlyOwner: true,
};
