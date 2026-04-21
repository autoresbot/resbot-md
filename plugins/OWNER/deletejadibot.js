import fs from "fs";
import path from "path";

import { determineUser, deleteFolderRecursive } from "../../lib/utils.js";
import { sessions } from "../../lib/cache.js";

async function handle(sock, messageInfo) {
  const {
    remoteJid,
    message,
    content,
    sender,
    mentionedJid,
    isQuoted,
    prefix,
    command,
  } = messageInfo;

  try {
    if (!content) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_\n\n_💬 Contoh:_ _*${
            prefix + command
          } 6285246154386*_`,
        },
        { quoted: message }
      );
      return;
    }

    const userToAction = determineUser(mentionedJid, isQuoted, content);
    if (!userToAction) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
            prefix + command
          } @NAME*_`,
        },
        { quoted: message }
      );
    }

    let targetNumber = userToAction.replace(/\D/g, ""); // Hanya angka

    if (targetNumber.length < 10 || targetNumber.length > 15) {
      await sock.sendMessage(
        remoteJid,
        { text: `⚠️ Nomor tidak valid.` },
        { quoted: message }
      );
      return;
    }

    if (!targetNumber.endsWith("@s.whatsapp.net")) {
      targetNumber += "@s.whatsapp.net";
    }

    // Loading
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Pastikan folder sesi ada
    const SESSION_PATH = "./session/";

    const senderId = targetNumber.replace("@s.whatsapp.net", "");
    const sessionPath = path.join(SESSION_PATH, senderId);
    const sessionExists = fs.existsSync(sessionPath);

    // Hapus sesi aktif
    const sockSesi = sessions.get(`session/${senderId}`);
    if (sockSesi) {
      const { updateJadibot } = require("@lib/jadibot");
      await updateJadibot(senderId, "stop");
      await sockSesi.ws.close(); // Tutup WebSocket
      sessions.delete(`session/${senderId}`); // Hapus dari daftar sesi
    }

    if (sessionExists) {
      // Hapus folder sesi
      deleteFolderRecursive(sessionPath);
      await sock.sendMessage(
        remoteJid,
        { text: `✅ _Folder sesi untuk ${senderId} berhasil dihapus._` },
        { quoted: message }
      );
      const { deleteJadibot } = require("@lib/jadibot");
      await deleteJadibot(senderId);
    } else {
      await sock.sendMessage(
        remoteJid,
        { text: `⚠️ _Folder sesi untuk ${senderId} tidak ditemukan._` },
        { quoted: message }
      );
    }
  } catch (error) {
    console.error("Terjadi kesalahan:", error);
    await sock.sendMessage(
      remoteJid,
      { text: `⚠️ Terjadi kesalahan saat memproses perintah.` },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["deletejadibot", "deljadibot"],
  OnlyPremium: false,
  OnlyOwner: true,
};
