import { resetGroupData } from "../../lib/utils.js";
import { getGroupMetadata } from "../../lib/cache.js";
import { deleteCache, clearCache } from "../../lib/globalCache.js";
import mess from "../../strings.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, sender, content, prefix, command } = messageInfo;

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

    // Jika perintah hanya kosong atau hanya spasi
    if (!content.trim()) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ _Perintah ini akan menghapus semua list di grub ini_ \n\nSilakan ketik *${
            prefix + command
          } -y* untuk melanjutkan.`,
        },
        { quoted: message }
      );
      return;
    }

    if (content.trim() === "-y") {
      await resetGroupData(remoteJid);
      deleteCache(`list-group`); // reset cache
      await sock.sendMessage(
        remoteJid,
        { text: "_Semua list di grub ini berhasil di reset_" },
        { quoted: message }
      );
    }
  } catch (error) {
    await sock.sendMessage(
      remoteJid,
      { text: "_❌ Maaf, terjadi kesalahan saat memproses data._" },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["resetlist"],
  OnlyPremium: false,
  OnlyOwner: false,
};
