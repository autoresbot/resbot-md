import {
  removeUser,
  getUser,
  isUserPlaying,
} from "../../database/temporary_db/math.js";
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
          text: `Yahh Menyerah\nJawaban: ${data.jawaban}\n\nIngin bermain? Ketik *.math*`,
        },
        { quoted: message }
      );
    }
    if (fullText.toLowerCase() == data.jawaban) {
      const hadiah = data.hadiah;
      if (data && data.timer) {
        clearTimeout(data.timer);
      }

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
          text: `🎉 Selamat! Jawaban Anda benar. Anda mendapatkan ${hadiah} Money.`,
        },
        { quoted: message }
      );
    }
  }

  return true; // Lanjutkan ke plugin berikutnya
}

export const name = "Math";
export const priority = 10;
export { process };
