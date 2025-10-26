// PROMOTE: Menjadikan semua anggota menjadi admin
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

    const members = groupMetadata.participants;

    // Filter hanya member yang belum menjadi admin
    const nonAdmins = members
      .filter((participant) => !participant.admin)
      .map((participant) => participant.id);

    if (nonAdmins.length === 0) {
      return await sock.sendMessage(
        remoteJid,
        { text: "_Semua anggota sudah menjadi admin._" },
        { quoted: message }
      );
    }

    // Promosikan semua non-admin menjadi admin
    await sock.groupParticipantsUpdate(remoteJid, nonAdmins, "promote");

    // Kirim pesan keberhasilan dengan jumlah anggota yang dipromosikan
    await sendMessageWithMention(
      sock,
      remoteJid,
      `*${nonAdmins.length}* _anggota telah dipromosikan menjadi admin._`,
      message,
      senderType
    );
  } catch (error) {
    console.error("Error in promoteall command:", error);

    // Kirim pesan kesalahan
    await sock.sendMessage(
      remoteJid,
      {
        text: "⚠️ Terjadi kesalahan saat mencoba menaikkan anggota menjadi admin.",
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["promoteall"],
  OnlyPremium: false,
  OnlyOwner: false,
};
