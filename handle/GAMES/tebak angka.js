import {
  removeUser,
  getUser,
  isUserPlaying,
} from "../../database/temporary_db/tebak angka.js";
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
          .replace("@answer", data.angkaAcak)
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

    if (!/^\d+$/.test(fullText)) {
      // Input bukan angka, diabaikan.
      return;
    }

    const guessedNumber = parseInt(fullText, 10);

    if (guessedNumber === data.angkaAcak) {
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
      if (data && data.timer) {
        clearTimeout(data.timer);
      }

      if (mess.game_handler.tebak_angka) {
        const messageNotif = mess.game_handler.tebak_angka.replace(
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
    } else {
      data.attempts -= 1;
      const hint =
        guessedNumber < data.angkaAcak
          ? `❗ Angka ${guessedNumber} terlalu kecil.`
          : `❗ Angka ${guessedNumber} terlalu besar.`;

      await sock.sendMessage(
        remoteJid,
        {
          text: `${hint} Sisa Percobaan : ${data.attempts}.`,
        },
        { quoted: message }
      );

      if (data.attempts <= 0) {
        if (data && data.timer) {
          clearTimeout(data.timer);
        }
        removeUser(remoteJid);
        await sock.sendMessage(
          remoteJid,
          {
            text: "❌ Sisa Percobaan habis. Game selesai.",
          },
          { quoted: message }
        );
      }
      return false;
    }

    return true; // Lanjutkan ke plugin berikutnya
  }

  return true; // Lanjutkan ke plugin berikutnya
}

export const name = "Tebak Angka";
export const priority = 10;
export { process };
