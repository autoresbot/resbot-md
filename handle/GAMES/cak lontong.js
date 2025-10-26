import {
  removeUser,
  getUser,
  isUserPlaying,
} from "../../database/temporary_db/cak lontong.js";
import { addUser, updateUser, deleteUser, findUser } from "../../lib/users.js";

async function process(sock, messageInfo) {
  const { remoteJid, content, fullText, message, sender } = messageInfo;

  if (isUserPlaying(remoteJid)) {
    const data = getUser(remoteJid);

    // Ketika menyerah
    if (fullText.toLowerCase().includes("nyerah")) {
      if (data && data.timer) {
        clearTimeout(data.timer);
      }
      removeUser(remoteJid);
      await sock.sendMessage(
        remoteJid,
        {
          text: `Yahh Menyerah\nJawaban: ${data.answer}\nDeskripsi : ${data.deskripsi}\n\nIngin bermain? Ketik *.cak lontong*`,
        },
        { quoted: message }
      );
    }

    if (fullText.toLowerCase() === data.answer) {
      if (data && data.timer) {
        clearTimeout(data.timer);
      }

      const hadiah = data.hadiah;

      // Mencari pengguna
      const user = await findUser(sender);

      if (user) {
        const [docId, userData] = user;

        const moneyAdd = (userData.money || 0) + hadiah; // Default money ke 0 jika undefined
        await updateUser(sender, { money: moneyAdd });
      } else {
      }

      removeUser(remoteJid);
      await sock.sendMessage(
        remoteJid,
        {
          text: `🎉 Selamat! Tebakan Anda benar. Anda mendapatkan ${hadiah} Money.`,
        },
        { quoted: message }
      );
    }
  }

  return true; // Lanjutkan ke plugin berikutnya
}

export const name = "Cak Lontong";
export const priority = 10;
export { process };
