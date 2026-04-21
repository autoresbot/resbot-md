import mess from "../../strings.js";
import { getGroupMetadata } from "../../lib/cache.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, sender, isGroup, content, prefix, command } =
    messageInfo;
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

    if (!content.trim() || content.trim() == "") {
      return sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
            prefix + command
          } open*_`.trim(),
        },
        { quoted: message }
      );
    }

    const [action] = content.split(" ");

    if (!["open", "close"].includes(action)) {
      return sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ Format tidak valid!\n_Silahkan Ketik:_\n_${command} open_\n_${command} close_`.trim(),
        },
        { quoted: message }
      );
    }
    const responseText = `${
      action === "open" ? mess.action.grub_open : mess.action.grub_close
    }`;

    await sock.groupSettingUpdate(
      remoteJid,
      action === "open" ? "not_announcement" : "announcement"
    );

    return sock.sendMessage(
      remoteJid,
      { text: responseText },
      { quoted: message }
    );
  } catch (error) {
    return sock.sendMessage(
      remoteJid,
      {
        text: "⚠️ Terjadi kesalahan. Pastikan bot memiliki izin admin untuk mengelola grup.",
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["grub", "group", "grup", "groub", "gc"],
  OnlyPremium: false,
  OnlyOwner: false,
};
