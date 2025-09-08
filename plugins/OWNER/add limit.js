const { findUser, updateUser } = require("@lib/users");
const { sendMessageWithMention } = require("@lib/utils");

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command, senderType } =
    messageInfo;

  // --- Validasi input ---
  if (!content?.trim()) {
    const tex =
      `_⚠️ Format: *${prefix + command} username/id 30*_\n\n` +
      `_💬 Contoh: *${prefix + command} azharicreative 50*_`;
    return sock.sendMessage(remoteJid, { text: tex }, { quoted: message });
  }

  // Pisahkan target dan jumlah limit
  const [rawNumber, rawLimit] = content.split(" ").map((s) => s.trim());

  if (!rawNumber || !rawLimit) {
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

  // Validasi jumlah limit
  const limitToAdd = parseInt(rawLimit, 10);
  if (isNaN(limitToAdd) || limitToAdd <= 0) {
    return sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ _Jumlah limit harus berupa angka positif_\n\n_Contoh: *${
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
    limit: (userData.limit || 0) + limitToAdd,
  });

  // --- Kirim pesan konfirmasi ---
  await sendMessageWithMention(
    sock,
    remoteJid,
    `✅ _Limit berhasil ditambah ${limitToAdd} untuk username/id ${rawNumber}._`,
    message,
    senderType
  );
}

module.exports = {
  handle,
  Commands: ["addlimit"],
  OnlyPremium: false,
  OnlyOwner: true,
};
