import { findUser, updateUser } from '../lib/users.js';
import { formatDuration, logTracking, sendMessageWithMention, convertToJid } from '../lib/utils.js'; // Fungsi untuk menghitung durasi waktu
import { logCustom } from '../lib/logger.js';
import mess from '../strings.js';

async function process(sock, messageInfo) {
  const { remoteJid, message, sender, senderLid, pushName, mentionedJid, isGroup } = messageInfo;

  try {
    // Fungsi untuk membangun pesan AFK saat user di-tag
    const buildAfkMessage = (name, afkData) => {
      if (!mess.handler?.afk) return null;
      const durasiAfk = formatDuration(afkData.lastChat || afkData.lastchat || 0);
      const alasanTeks = afkData.alasan ? `\n\n📌 ${afkData.alasan}` : '\n\n📌 Tanpa Alasan';

      const quotedSender = `@${name.split('@')[0]}`;

      return mess.handler.afk
        .replace('@sender', quotedSender)
        .replace('@durasi', durasiAfk)
        .replace('@alasan', alasanTeks);
    };

    // Cek jika ada user lain yang di-tag dan sedang AFK (hanya di grup)
    if (isGroup && Array.isArray(mentionedJid) && mentionedJid.length > 0) {
      for (const jid of mentionedJid) {
        const mentionedUser = findUser(jid, 'Debug 3');
        if (!Array.isArray(mentionedUser)) continue; // skip jika tidak ditemukan atau bukan array

        const [, userData] = mentionedUser;
        if (userData?.status === 'afk' && userData.afk) {
          const numberJid = await convertToJid(sock, jid);

          const afkMessage = buildAfkMessage(numberJid || 'Pengguna', userData.afk);
          if (afkMessage) {
            logTracking(`Afk Handler (tag) - ${jid}`);

            await sendMessageWithMention(sock, remoteJid, afkMessage, message, numberJid);
          }
          break; // cukup notif sekali per pesan
        }
      }
    }

    // Cek status AFK pengguna yang sedang mengirim pesan (kembali dari AFK)

    const dataUsers = findUser(senderLid, 'Debug 4');
    if (!Array.isArray(dataUsers)) return true;
    const [, userAfk] = dataUsers;

    if (userAfk?.status === 'afk' && userAfk.afk) {
      if (mess.handler?.afk_message) {
        const afkMessage = mess.handler.afk_message
          .replace('@sender', pushName)
          .replace('@durasi', formatDuration(userAfk.afk.lastChat || userAfk.afk.lastchat || 0))
          .replace(
            '@alasan',
            userAfk.afk.alasan ? `\n\n📌 ${userAfk.afk.alasan}` : '\n\n📌 Tanpa Alasan',
          );

        if (afkMessage) {
          logTracking(`Afk Handler (kembali) - ${sender}`);
          await sock.sendMessage(remoteJid, { text: afkMessage }, { quoted: message });
        }
      }

      await updateUser(senderLid, { status: 'aktif', afk: null });
      return false;
    }
  } catch (error) {
    logCustom('error', error, `ERROR-AFK-HANDLE.txt`);
  }

  return true; // Lanjutkan ke plugin berikutnya
}

export default {
  name: 'Afk',
  priority: 3,
  process,
};
