import { sendMessageWithMention } from "../../lib/utils.js";
import { getGroupMetadata } from "../../lib/cache.js";
import mess from "../../strings.js";

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

    // Filter peserta dengan status admin.
    // Mention dikirim eksplisit (bukan ditebak dari senderType) supaya tetap
    // benar kalau ada admin yang WhatsApp-nya tidak mengirim `phone_number`,
    // sehingga yang terpakai LID-nya.
    const mentions = participants
      .filter((p) => p.admin !== null)
      .map((admin) => admin.phoneNumber || admin.id)
      .filter((jid) => typeof jid === "string");

    const adminList = mentions.map((jid) => `◧ @${jid.split("@")[0]}`).join("\n");

    // Cek jika tidak ada admin
    if (!adminList || adminList.trim() === "") {
      return await sock.sendMessage(
        remoteJid,
        { text: "⚠️ _Tidak ada admin dalam grup ini._" },
        { quoted: message }
      );
    }

    // Teks notifikasi daftar admin
    const textNotif = `📋 *Daftar Admin Grup:*\n\n${adminList}`;

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
    console.error("Error handling listadmin:", error);
    await sock.sendMessage(
      remoteJid,
      { text: "⚠️ Terjadi kesalahan saat menampilkan daftar admin." },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["listadmin"],
  OnlyPremium: false,
  OnlyOwner: false,
};
