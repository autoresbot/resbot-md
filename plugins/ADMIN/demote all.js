// DEMOTE ALL: Menjadikan semua admin menjadi user biasa
import mess from "../../strings.js";
import { sendMessageWithMention } from "../../lib/utils.js";
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
    const members = participants;

    // Filter hanya member yang merupakan admin
    const admins = members
      .filter((participant) => participant.admin)
      .map((participant) => participant.id);

    if (admins.length === 0) {
      return await sock.sendMessage(
        remoteJid,
        { text: "Tidak ada admin yang bisa diturunkan." },
        { quoted: message }
      );
    }

    // Turunkan semua admin menjadi user biasa
    await sock.groupParticipantsUpdate(remoteJid, admins, "demote");

    // Kirim pesan keberhasilan dengan jumlah admin yang diturunkan
    await sendMessageWithMention(
      sock,
      remoteJid,
      `*${admins.length}* _admin telah diturunkan menjadi user biasa._`,
      message,
      senderType
    );
  } catch (error) {
    console.error("Error in demoteall command:", error);

    // Kirim pesan kesalahan
    await sock.sendMessage(
      remoteJid,
      {
        text: "⚠️ Terjadi kesalahan saat mencoba menurunkan admin menjadi user biasa.",
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["demoteall"],
  OnlyPremium: false,
  OnlyOwner: false,
};
