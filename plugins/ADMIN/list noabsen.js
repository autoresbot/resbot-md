import { findAbsen } from "../../lib/absen.js";
import { sendMessageWithMention } from "../../lib/utils.js";
import mess from "../../strings.js";
import { getGroupMetadata } from "../../lib/cache.js";

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender, senderType } = messageInfo;
  if (!isGroup) return; // Hanya bisa digunakan di grup

  try {
    // Ambil metadata grup
    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    const participants = groupMetadata.participants;
    const totalMembers = participants.length;

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

    // Ambil data absen
    const data = await findAbsen(remoteJid);
    const absenMembers = data?.member || [];

    // Dapatkan daftar yang belum absen
    const noAbsenMembers = participants
      .filter((p) => !absenMembers.includes(p.id))
      .map((p, index) => `${index + 1}. @${p.id.split("@")[0]}`);

    let textNotif;
    if (noAbsenMembers.length > 0) {
      textNotif =
        `📋 *Daftar Yang Belum Absen:*\n\n${noAbsenMembers.join("\n")}\n\n` +
        `⏳ *${noAbsenMembers.length} orang belum absen hari ini.*`;
    } else {
      textNotif = "✅ Semua anggota sudah absen hari ini.";
    }

    await sendMessageWithMention(
      sock,
      remoteJid,
      textNotif,
      message,
      senderType
    );
  } catch (error) {
    console.error("Error handling listnoabsen:", error);
    await sock.sendMessage(
      remoteJid,
      {
        text: "⚠️ Terjadi kesalahan saat menampilkan daftar yang belum absen.",
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["listnoabsen"],
  OnlyPremium: false,
  OnlyOwner: false,
};
