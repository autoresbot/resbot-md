import { updateKeyword } from "../../lib/list.js";
import { getGroupMetadata } from "../../lib/cache.js";
import mess from "../../strings.js";

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, content, sender, command, prefix } =
    messageInfo;

  try {
    let idList = remoteJid;

    if (!isGroup) {
      // Chat Pribadi
      idList = "owner";
    } else {
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
    }

    // Pisahkan keyword dan teks
    const [keywordOld, keywordNew] = content
      .split("|")
      .map((item) => item.trim().toLowerCase());

    if (!keywordOld || !keywordNew) {
      return sendMessageWithTemplate(
        sock,
        remoteJid,
        `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
          prefix + command
        } keylama | keybaru*_`,
        message
      );
    }

    const updatedStatus = await updateKeyword(idList, keywordOld, keywordNew);

    if (updatedStatus && updatedStatus.success) {
      return sendMessageWithTemplate(
        sock,
        remoteJid,
        updatedStatus.message,
        message
      );
    } else {
      return sendMessageWithTemplate(
        sock,
        remoteJid,
        updatedStatus.message,
        message
      );
    }
  } catch (error) {
    console.error("Error processing command:", error);
    return sendMessageWithTemplate(
      sock,
      remoteJid,
      "_❌ Maaf, terjadi kesalahan saat memproses data._",
      message
    );
  }
}

// Fungsi untuk mengirim pesan dengan template
function sendMessageWithTemplate(sock, remoteJid, text, quoted) {
  return sock.sendMessage(remoteJid, { text }, { quoted });
}

export default {
  handle,
  Commands: ["renamelist"],
  OnlyPremium: false,
  OnlyOwner: false,
};
