import { setPromote } from "../../lib/participants.js";
import { getGroupMetadata } from "../../lib/cache.js";
import mess from "../../strings.js";

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, content, sender, command, prefix } =
    messageInfo;
  if (!isGroup) return; // Only Grub

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

  // Validasi input kosong
  if (!content || !content.trim()) {
    const MSG = `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
      prefix + command
    } Selamat @name sekarang menjadi admin*_
        
_*List Variable*_

${global.group.variable}`;
    return await sock.sendMessage(
      remoteJid,
      { text: MSG },
      { quoted: message }
    );
  }

  await setPromote(remoteJid, content);

  // Kirim pesan berhasil
  return await sock.sendMessage(
    remoteJid,
    {
      text: `✅ _Promote Berhasil di set_\n\n_Pastikan fitur sudah di aktifkan dengan mengetik *.on promote*_`,
    },
    { quoted: message }
  );
}

export default {
  handle,
  Commands: ["setpromote"],
  OnlyPremium: false,
  OnlyOwner: false,
};
