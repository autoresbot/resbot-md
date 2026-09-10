import mess from "../../strings.js";
import config from "../../config.js";
import { getGroupMetadata } from "../../lib/cache.js";
import { determineUser } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const {
    remoteJid,
    isGroup,
    message,
    sender,
    mentionedJid,
    isQuoted,
    content,
    prefix,
    command,
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

    const targetNumber = userToAction.split("@")[0];

    if (targetNumber === config.phone_number_bot) {
      return await sock.sendMessage(
        remoteJid,
        { text: `⚠️ _Tidak dapat kick nomor sendiri_` },
        { quoted: message }
      );
    }

    // Mengeluarkan pengguna dari grup
    const kickResult = await sock.groupParticipantsUpdate(
      remoteJid,
      [userToAction],
      "remove"
    );
    if (kickResult && mess.action.user_kick) {
      return await sock.sendMessage(
        remoteJid,
        { text: mess.action.user_kick },
        { quoted: message }
      );
    }
  } catch (error) {
    console.error("Error handling kick:", error);
    await sock.sendMessage(
      remoteJid,
      {
        text: "⚠️ Terjadi kesalahan saat mencoba mengeluarkan pengguna. Pastikan bot memiliki izin.",
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["kick"],
  OnlyPremium: false,
  OnlyOwner: false,
};
