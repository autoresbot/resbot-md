import { getDataByGroupId } from "../../lib/list.js";
import { sendMessageWithMention } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, senderType } = messageInfo;

  try {
    // Ambil data list berdasarkan grup
    const currentList = await getDataByGroupId("owner");

    // Jika tidak ada list
    if (!currentList || !currentList.list) {
      await sock.sendMessage(remoteJid, {
        text: "⚠️ _Tidak Ada Daftar Respon, silakan ketik *addrespon* untuk membuat baru_\n\n_Hanya *owner* yang dapat menambah / menghapus respon_",
      });
      return;
    }

    const keywordList = Object.keys(currentList.list);

    if (keywordList.length === 0) {
      await sock.sendMessage(remoteJid, {
        text: "⚠️ _Tidak Ada Daftar Respon, silakan ketik *addrespon* untuk membuat baru_\n\n_Hanya *owner* yang dapat menambah / menghapus respon_",
      });
    } else {
      const formattedList = keywordList
        .map((keyword) => `◧ ${keyword.toUpperCase()}`)
        .join("\n");

      // Template pesan
      const templateMessage = `╭✄ *BERIKUT DAFTAR RESPON*\n\n${formattedList}\n╰──────────◇`;

      // Kirim pesan dengan mention
      await sendMessageWithMention(
        sock,
        remoteJid,
        templateMessage,
        message,
        senderType
      );
    }
  } catch (error) {
    console.error(error);
  }
}

export default {
  handle,
  Commands: ["listrespon"],
  OnlyPremium: false,
  OnlyOwner: true,
};
