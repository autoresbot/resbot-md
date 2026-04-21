import { deleteList, getDataByGroupId } from "../../lib/list.js";
import { getGroupMetadata } from "../../lib/cache.js";
import { deleteCache } from "../../lib/globalCache.js";
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

    // Validasi input konten
    if (!content) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
            prefix + command
          } payment*_`,
        },
        { quoted: message }
      );
      return; // Hentikan eksekusi jika tidak ada konten
    }

    // Cek apakah keyword sudah ada
    const currentList = await getDataByGroupId(idList);
    const lowercaseKeyword = content.trim().toLowerCase();

    if (currentList?.list?.[lowercaseKeyword]) {
      await deleteList(idList, lowercaseKeyword);
      deleteCache(`list-${idList}`);
      return sendMessageWithTemplate(
        sock,
        remoteJid,
        `Keyword *${lowercaseKeyword}* berhasil dihapus.`,
        message
      );
    } else {
      return sendMessageWithTemplate(
        sock,
        remoteJid,
        `Keyword *${lowercaseKeyword}* tidak ditemukan.`,
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
  Commands: ["dellist", "deletelist"],
  OnlyPremium: false,
  OnlyOwner: false,
};
