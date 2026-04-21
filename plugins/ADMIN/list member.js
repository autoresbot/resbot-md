import { sendMessageWithMention } from "../../lib/utils.js";
import mess from "../../strings.js";
import { getGroupMetadata } from "../../lib/cache.js";

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender, senderType } = messageInfo;
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

    // Filter peserta bukan admin
    const memberList = participants
      .filter((participant) => participant.admin === null)
      .map((member, index) => `◧ @${member.id.split("@")[0]}`)
      .join("\n");

    // Cek jika tidak ada member non-admin
    if (!memberList) {
      return await sock.sendMessage(
        remoteJid,
        { text: "⚠️ Tidak ada member non-admin dalam grup ini." },
        { quoted: message }
      );
    }

    // Teks notifikasi daftar member non-admin
    const textNotif = `📋 *Daftar Member Non-Admin:*\n\n${memberList}`;

    // Kirim pesan dengan mention
    await sendMessageWithMention(
      sock,
      remoteJid,
      textNotif,
      message,
      senderType
    );
  } catch (error) {
    console.error("Error handling listmember:", error);
    await sock.sendMessage(
      remoteJid,
      {
        text: "⚠️ Terjadi kesalahan saat menampilkan daftar member non-admin.",
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["listmember"],
  OnlyPremium: false,
  OnlyOwner: false,
};
