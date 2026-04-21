import mess from "../../strings.js";
import { addFiturBlock } from "../../lib/group.js";
import { getGroupMetadata } from "../../lib/cache.js";
import { sendMessageWithMention } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const {
    remoteJid,
    isGroup,
    message,
    sender,
    isQuoted,
    content,
    prefix,
    command,
    mentionedJid,
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

  if (!content) {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
          prefix + command
        } pin*_`,
      },
      { quoted: message }
    );
  }

  try {
    await addFiturBlock(remoteJid, content.trim());
    await sendMessageWithMention(
      sock,
      remoteJid,
      `_Fitur *${content}* Berhasil di ban untuk grub ini_\n\n_Untuk membuka fitur ketik *.unbanfitur*_`,
      message,
      senderType
    );
  } catch (error) {
    console.log(error);
    await sendMessageWithMention(
      sock,
      remoteJid,
      `❌ _Tidak dapat ban nomor_ @${whatsappJid.split("@")[0]}`,
      message,
      senderType
    );
  }
}

export default {
  handle,
  Commands: ["banfitur"],
  OnlyPremium: false,
  OnlyOwner: false,
};
