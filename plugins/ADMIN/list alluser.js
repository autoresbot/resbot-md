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

    // Teks dan mention dibangun dari JID YANG SAMA. Kalau keduanya berbeda
    // (mis. teks memakai LID sementara mention ditebak jadi @s.whatsapp.net),
    // WhatsApp menampilkan LID itu sebagai nomor telepon asing, bukan tag.
    const mentions = participants.map((m) => m.phoneNumber || m.id).filter(Boolean);

    // Daftar semua anggota grup
    const memberList = mentions.map((jid) => `◧ @${jid.split("@")[0]}`).join("\n");

    // Cek jika tidak ada anggota
    if (!memberList) {
      return await sock.sendMessage(
        remoteJid,
        { text: "⚠️ _Tidak ada anggota dalam grup ini._" },
        { quoted: message }
      );
    }

    // Teks notifikasi daftar anggota
    const textNotif = `📋 *Daftar Semua Anggota Grup: ${participants.length}*\n\n${memberList}`;

    // Kirim pesan dengan mention
    await sendMessageWithMention(
      sock,
      remoteJid,
      textNotif,
      message,
      senderType,
      mentions
    );
  } catch (error) {
    console.error("Error handling listalluser:", error);
    await sock.sendMessage(
      remoteJid,
      { text: "⚠️ Terjadi kesalahan saat menampilkan semua anggota grup." },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["listalluser"],
  OnlyPremium: false,
  OnlyOwner: false,
};
