import { findUser } from '../../lib/users.js';
import { sendMessageWithMention, convertToJid } from '../../lib/utils.js';

/* ===================== UTILS ===================== */

/* ===================== HANDLER ===================== */

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command, senderType } = messageInfo;

  // --- Validasi input ---
  if (!content?.trim()) {
    return sock.sendMessage(
      remoteJid,
      {
        text:
          `_⚠️ Format: *${prefix + command} @tag*_\n\n` +
          `_💬 Contoh: *${prefix + command} @628xxx*_`,
      },
      { quoted: message },
    );
  }

  // --- Ambil target ---
  const targetJid = String(content || '').replace(/[^0-9]/g, '');

  if (!targetJid) {
    return sock.sendMessage(
      remoteJid,
      {
        text:
          `_❌ Target tidak valid_\n\n` +
          `_Gunakan mention atau nomor_\n` +
          `_Contoh: *${prefix + command} @tag*_`,
      },
      { quoted: message },
    );
  }

  // --- Ambil data user ---
  const dataUsers = await findUser(targetJid);

  if (!dataUsers || !dataUsers[1]) {
    return sock.sendMessage(remoteJid, { text: `_❌ User tidak ditemukan_` }, { quoted: message });
  }

  const [, userData] = dataUsers;

  const number = await convertToJid(sock, targetJid);

  // --- Format response ---
  const text = `✅ *Informasi User*

👤 *ID:* @${number.split('@')[0]}
💎 *Limit:* ${userData.limit || 0}
💰 *Money:* ${userData.money || 0}
⭐ *Level:* ${userData.level || 0}`;

  // --- Kirim ---
  await sendMessageWithMention(sock, remoteJid, text, message, senderType);
}

export default {
  handle,
  Commands: ['cekuser'],
  OnlyPremium: false,
  OnlyOwner: true,
};
