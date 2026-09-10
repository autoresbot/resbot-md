import mess from "../../strings.js";
import { resetTotalChatPerGroup } from "../../lib/totalchat.js";
import { sendMessageWithMention } from "../../lib/utils.js";
import { getGroupMetadata } from "../../lib/cache.js";

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender, senderType } = messageInfo;
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

    await resetTotalChatPerGroup(remoteJid);

    // Kirim pesan dengan mention
    await sendMessageWithMention(
      sock,
      remoteJid,
      "_Total Chat di grub ini berhasil direset_",
      message,
      senderType
    );
  } catch (error) {
    console.error("Error handling reset total chat command:", error);
    return await sock.sendMessage(
      remoteJid,
      { text: "Terjadi kesalahan saat memproses permintaan Anda." },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["resettotalchat"],
  OnlyPremium: false,
  OnlyOwner: false,
};
