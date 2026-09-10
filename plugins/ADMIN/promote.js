// PROMOTE: Menjadikan users ke admin

import mess from "../../strings.js";
import { sendMessageWithMention, determineUser } from "../../lib/utils.js";
import { getGroupMetadata } from "../../lib/cache.js";

async function handle(sock, messageInfo) {
  const {
    remoteJid,
    isGroup,
    message,
    sender,
    mentionedJid,
    content,
    isQuoted,
    prefix,
    command,
    senderType,
  } = messageInfo;
  if (!isGroup) return; // Only Grub

  try {
    // Mendapatkan metadata grup
    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    const participants = groupMetadata.participants;
    const isAdmin = participants.some(
      (p) => (p.phoneNumber === sender || p.id === sender) && p.admin
    );
    if (!isAdmin) {
      await sock.sendMessage(
        remoteJid,
        { text: mess.general.isAdmin },
        { quoted: message }
      );
      return;
    }

    // Menentukan pengguna
    const userToAction = determineUser(mentionedJid, isQuoted, content);
    if (!userToAction) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
            prefix + command
          } @NAME*_`,
        },
        { quoted: message }
      );
    }

    // Proses demote
    await sock.groupParticipantsUpdate(remoteJid, [userToAction], "promote");

    // Kirim pesan dengan mention
    await sendMessageWithMention(
      sock,
      remoteJid,
      `@${userToAction.split("@")[0]} Telah Menjadi admin grub`,
      message,
      senderType
    );
  } catch (error) {
    console.error("Error in promote command:", error);

    // Kirim pesan kesalahan
    await sock.sendMessage(
      remoteJid,
      { text: "⚠️ Terjadi kesalahan saat mencoba menaikkan menjadi admin." },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["promote"],
  OnlyPremium: false,
  OnlyOwner: false,
};
