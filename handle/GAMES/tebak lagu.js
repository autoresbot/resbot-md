import {
  removeUser,
  getUser,
  isUserPlaying,
} from "../../database/temporary_db/tebak lagu.js";
import { addUser, updateUser, deleteUser, findUser } from "../../lib/users.js";
import mess from "../../strings.js";

async function process(sock, messageInfo) {
  const { remoteJid, content, fullText, message, sender } = messageInfo;

  if (isUserPlaying(remoteJid)) {
    const data = getUser(remoteJid);

    // Ketika menyerah
    if (fullText.toLowerCase().includes("nyerah")) {
      removeUser(remoteJid);

      if (data && data.timer) {
        clearTimeout(data.timer);
      }

      if (mess.game_handler.menyerah) {
        const messageWarning = mess.game_handler.menyerah
          .replace("@answer", data.answer)
          .replace("@command", data.command);

        await sock.sendMessage(
          remoteJid,
          {
            text: messageWarning,
          },
          { quoted: message }
        );
      }

      return false;
    }

    if (fullText.toLowerCase() === data.answer) {
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
      if (mess.game_handler.tebak_lagu) {
        const messageNotif = mess.game_handler.tebak_lagu.replace(
          "@hadiah",
          hadiah
        );
        await sock.sendMessage(
          remoteJid,
          {
            text: messageNotif,
          },
          { quoted: message }
        );
      }

      return false;
    }
  }

  return true; // Lanjutkan ke plugin berikutnya
}

export default {
  name: "Tebak Lagu",
  priority: 10,
  process,
};
