import { findUser, updateUser } from '../../lib/users.js';
import { sendMessageWithMention } from '../../lib/utils.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command, senderType } = messageInfo;

  // --- Validasi input ---
  if (!content?.trim()) {
    const tex =
      `_⚠️ Format: *${prefix + command} tag 30*_\n\n` +
      `_💬 Contoh: *${prefix + command} @tag 50*_`;
    return sock.sendMessage(remoteJid, { text: tex }, { quoted: message });
  }

  // Pisahkan target dan jumlah limit
  const [rawNumber, rawLimit] = content.split(' ').map((s) => s.trim());

  if (!rawNumber || !rawLimit) {
    return sock.sendMessage(
      remoteJid,
      {
        text: `_Masukkan format yang benar_\n\n_Contoh: *${prefix + command} @tag 50*_`,
      },
      { quoted: message },
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
      { quoted: message },
    );
  }

  // --- Cek user single function ---
  let dataUsers = await findUser(rawNumber);

  const [docId, userData] = dataUsers;

  // --- Update data user ---
  await updateUser(rawNumber, {
    limit: (userData.limit || 0) + limitToAdd,
  });

  // --- Kirim pesan konfirmasi ---
  await sendMessageWithMention(
    sock,
    remoteJid,
    `✅ _Limit berhasil ditambahkan ${limitToAdd}_`,
    message,
    senderType,
  );
}

export default {
  handle,
  Commands: ['addlimit'],
  OnlyPremium: false,
  OnlyOwner: true,
};
