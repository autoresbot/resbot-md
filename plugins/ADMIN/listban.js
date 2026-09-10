import mess from "../../strings.js";
import { getUserBlockList } from "../../lib/group.js";
import { getGroupMetadata } from "../../lib/cache.js";
import { sendMessageWithMention } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender, senderType } = messageInfo;

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

  try {
    const listBaned = await getUserBlockList(remoteJid);

    if (listBaned.length > 0) {
      // JID yang tersimpan dipakai APA ADANYA sebagai mention — domainnya
      // (@lid / @s.whatsapp.net) tidak boleh ditebak dari senderType, karena
      // itu tipe pengirim perintah, bukan tipe orang yang di-tag.
      const mentions = listBaned.filter(Boolean);

      // Membuat daftar anggota yang di-ban dalam format yang diinginkan
      const memberList = mentions
        .map((member) => `◧ @${member.split("@")[0]}`)
        .join("\n");

      const textNotif = `📋 *LIST BAN: ${listBaned.length}*\n\n${memberList}`;
      await sendMessageWithMention(
        sock,
        remoteJid,
        textNotif,
        message,
        senderType,
        mentions
      );
    } else {
      return await sock.sendMessage(
        remoteJid,
        { text: "⚠️ _Tidak ada anggota yang di ban_" },
        { quoted: message }
      );
    }
  } catch (error) {
    console.error("Error handling listban command:", error);
    return await sock.sendMessage(
      remoteJid,
      { text: "Terjadi kesalahan saat memproses permintaan Anda." },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["listban"],
  OnlyPremium: false,
  OnlyOwner: false,
};
