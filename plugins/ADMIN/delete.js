import mess from "../../strings.js";
import { getGroupMetadata } from "../../lib/cache.js";

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, isQuoted, sender } = messageInfo;
  if (!isGroup) return; // Only Grub

  try {
    // Mendapatkan metadata grup
    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    const participants = groupMetadata.participants;
    const isAdmin = participants.some(
      (p) => (p.phoneNumber === sender || p.id === sender) && p.admin
    );
    if (!isAdmin) {
      await sock.sendMessage(
        remoteJid,
        { text: mess.general.isAdmin },
        { quoted: message }
      );
      return;
    }

    // Jika ada pesan yang dikutip, hapus pesan tersebut
    if (isQuoted) {
      await sock.sendMessage(remoteJid, {
        delete: {
          remoteJid,
          id: isQuoted.id,
          participant: isQuoted.sender,
        },
      });
    } else {
      await sock.sendMessage(
        remoteJid,
        { text: "⚠️ _Balas pesan yang mau di hapus_" },
        { quoted: message }
      );
    }
  } catch (error) {
    console.error("Error handling command:", error);
    await sock.sendMessage(remoteJid, {
      text: "Terjadi kesalahan. Silakan coba lagi.",
    });
  }
}

export default {
  handle,
  Commands: ["del", "delete"],
  OnlyPremium: false,
  OnlyOwner: false,
};
