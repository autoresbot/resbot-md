import { deleteList, getDataByGroupId } from "../../lib/list.js";
import { deleteCache } from "../../lib/globalCache.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, sender, command, prefix } = messageInfo;

  try {
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
    const currentList = await getDataByGroupId("owner");
    const lowercaseKeyword = content.trim().toLowerCase();

    if (currentList?.list?.[lowercaseKeyword]) {
      await deleteList("owner", lowercaseKeyword);
      deleteCache(`list-owner`); // reset cache
      return sendMessageWithTemplate(
        sock,
        remoteJid,
        `✅ _Keyword *${lowercaseKeyword}* berhasil dihapus._`,
        message
      );
    } else {
      return sendMessageWithTemplate(
        sock,
        remoteJid,
        `⚠️ _Keyword *${lowercaseKeyword}* tidak ditemukan._`,
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
  Commands: ["delrespon", "deleterespon"],
  OnlyPremium: false,
  OnlyOwner: true,
};
