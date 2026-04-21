import mess from "../../strings.js";
import { removeUserFromBlock } from "../../lib/group.js";
import { getGroupMetadata } from "../../lib/cache.js";
import { sendMessageWithMention, determineUser } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const {
    remoteJid,
    isGroup,
    message,
    sender,
    content,
    prefix,
    command,
    mentionedJid,
    isQuoted,
    senderType,
  } = messageInfo;

  if (!isGroup) return; // Only Grub

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

  // Menentukan pengguna yang akan dikeluarkan
  const userToBan = determineUser(mentionedJid, isQuoted, content);
  if (!userToBan) {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
          prefix + command
        } 6285246154386*_`,
      },
      { quoted: message }
    );
  }
  const whatsappJid = userToBan;

  try {
    const result = await removeUserFromBlock(remoteJid, whatsappJid);
    if (result) {
      await sendMessageWithMention(
        sock,
        remoteJid,
        `✅ @${whatsappJid.split("@")[0]} _Berhasil di unban untuk grub ini_`,
        message,
        senderType
      );
    } else {
      await sendMessageWithMention(
        sock,
        remoteJid,
        `⚠️ @${whatsappJid.split("@")[0]} _Tidak di temukan di list ban_`,
        message,
        senderType
      );
    }
  } catch (error) {
    console.log(error);
    await sendMessageWithMention(
      sock,
      remoteJid,
      `❌ _Tidak dapat unban nomor_ @${whatsappJid.split("@")[0]}`,
      message,
      senderType
    );
  }
}

export default {
  handle,
  Commands: ["unban"],
  OnlyPremium: false,
  OnlyOwner: false,
};
