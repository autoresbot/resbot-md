import { findUser, updateUser } from "../lib/users.js";
import { formatDuration, logTracking } from "../lib/utils.js"; // Fungsi untuk menghitung durasi waktu
import { logCustom } from "../lib/logger.js";
import mess from "../strings.js";

async function process(sock, messageInfo) {
  const { remoteJid, message, sender, pushName, mentionedJid } = messageInfo;

  try {
    // Fungsi untuk membangun pesan AFK
    const buildAfkMessage = (name, afkData) => {
      const durasiAfk = formatDuration(afkData.lastChat);
      const alasanTeks = afkData.alasan
        ? `\n\n📌 ${afkData.alasan}`
        : "\n\n📌 Tanpa Alasan";

      if (mess.handler.afk) {
        let warningMessage = mess.handler.afk
          .replace("@sender", name)
          .replace("@durasi", durasiAfk)
          .replace("@alasan", alasanTeks);
        return warningMessage;
      }
      return null;
    };

    if (mentionedJid?.length > 0) {
      const mentionedUsers = await Promise.all(
        mentionedJid.map(async (jid) => {
          return await findUser(jid); // Ambil data pengguna berdasarkan JID
        })
      );

      for (const mentionedUser of mentionedUsers) {
        if (!mentionedUser) continue; // skip kalau user tidak ditemukan

        const [docId, userData] = mentionedUser;

        // Contoh: jika user tersebut lagi afk
        if (userData?.status === "afk" && userData.afk) {
          const afkMessage = buildAfkMessage(
            userData.username || "Pengguna",
            userData.afk
          );
          if (afkMessage) {
            logTracking(`Afk Handler - ${sender}`);
            await sock.sendMessage(
              remoteJid,
              { text: afkMessage },
              { quoted: message }
            );
          }
          break; // Keluar dari loop setelah mengirim pesan pertama
        }
      }
    }

    // Cek status AFK pengguna saat ini
    const dataUsers = await findUser(sender);
    if (!dataUsers) return;
    const [docId, userAfk] = dataUsers;
    if (userAfk?.status === "afk" && userAfk.afk) {
      if (mess.handler?.afk_message) {
        const afkMessage = mess.handler.afk_message
          .replace("@sender", pushName)
          .replace("@durasi", formatDuration(userAfk.afk.lastChat))
          .replace(
            "@alasan",
            userAfk.afk.alasan
              ? `\n\n📌 ${userAfk.afk.alasan}`
              : "\n\n📌 Tanpa Alasan"
          );

        if (afkMessage) {
          logTracking(`Afk Handler - ${sender}`);
          await sock.sendMessage(
            remoteJid,
            { text: afkMessage },
            { quoted: message }
          );
        }
      }

      await updateUser(sender, { status: "aktif", afk: null });
      return false;
    }
  } catch (error) {
    console.error("Error in AFK process:", error);
    logCustom("info", error, `ERROR-AFK-HANDLE.txt`);
  }

  return true; // Lanjutkan ke plugin berikutnya
}

export default {
  name: "Afk",
  priority: 3,
  process,
};
