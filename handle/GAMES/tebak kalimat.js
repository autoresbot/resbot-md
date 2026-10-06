import { removeUser, getUser, isUserPlaying } from '../../database/temporary_db/tebak kalimat.js';
import { addUser, updateUser, deleteUser, findUser } from '../../lib/users.js';
import mess from '../../strings.js';

/** Samakan bentuk jawaban: huruf kecil, tanpa spasi berlebih. */
function rapikanJawaban(teks) {
  return String(teks || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

async function process(sock, messageInfo) {
  const { remoteJid, content, fullText, message, sender, senderLid } = messageInfo;

  if (isUserPlaying(remoteJid)) {
    const data = getUser(remoteJid);
    if (!data) return true;

    const jawabanPemain = rapikanJawaban(fullText);

    // Ketika menyerah
    if (jawabanPemain.includes('nyerah')) {
      removeUser(remoteJid);
      if (data && data.timer) {
        clearTimeout(data.timer);
      }
      if (mess.game_handler.menyerah) {
        const messageWarning = mess.game_handler.menyerah
          .replace('@answer', data.answer)
          .replace('@command', data.command);

        await sock.sendMessage(
          remoteJid,
          {
            text: messageWarning,
          },
          { quoted: message },
        );
      }
      return false;
    }

    if (jawabanPemain === rapikanJawaban(data.answer)) {
      const hadiah = data.hadiah;

      // Mencari pengguna
      const user = await findUser(senderLid, 'tebak kalimat game');

      if (user) {
        const [docId, userData] = user;
        const moneyAdd = (userData.money || 0) + hadiah; // Default money ke 0 jika undefined
        await updateUser(senderLid, { money: moneyAdd });
      } else {
      }

      if (data && data.timer) {
        clearTimeout(data.timer);
      }
      removeUser(remoteJid);
      if (mess.game_handler.tebak_kalimat) {
        const messageNotif = mess.game_handler.tebak_kalimat.replace('@hadiah', hadiah);
        await sock.sendMessage(
          remoteJid,
          {
            text: messageNotif,
          },
          { quoted: message },
        );
      }

      return false;
    }
  }

  return true; // Lanjutkan ke plugin berikutnya
}

export const name = 'Tebak Kalimat';
export const priority = 10;
export { process };
