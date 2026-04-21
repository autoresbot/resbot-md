import mess from "../../strings.js";
import { addSlr } from "../../lib/slr.js";
import { getGroupMetadata } from "../../lib/cache.js";

async function handle(sock, messageInfo) {
  const {
    remoteJid,
    isGroup,
    message,
    sender,
    isQuoted,
    content,
    prefix,
    command,
    mentionedJid,
  } = messageInfo;

  if (!isGroup) return; // Only Grub

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

  if (!content) {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
          prefix + command
        } admin sedang slow respon*_\n\n_Untuk mematikan fitur ini ketik *.slr off*_`,
      },
      { quoted: message }
    );
  }

  if (content.toLowerCase() == "off") {
    await addSlr(remoteJid, false, "");
    return await sock.sendMessage(
      remoteJid,
      { text: `✅ _Slr berhasil dimatikan_` },
      { quoted: message }
    );
  } else {
    await addSlr(remoteJid, true, content.trim());
    return await sock.sendMessage(
      remoteJid,
      { text: `✅ _Slr berhasil di Set_` },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["slr"],
  OnlyPremium: false,
  OnlyOwner: false,
};
