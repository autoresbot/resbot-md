import mess from "../../strings.js";
import { getGroupMetadata } from "../../lib/cache.js";

async function sendTextMessage(sock, remoteJid, text, quoted) {
  // Fungsi helper untuk mengirim pesan teks
  return await sock.sendMessage(remoteJid, { text }, { quoted });
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, sender, content, isQuoted } = messageInfo;

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

    // Pesan default jika tidak ada konten
    const messageContent = content?.trim() || "kosong";

    // Buat teks tag semua
    let teks = `══✪〘 *👥 Tag All* 〙✪══\n➲ *Pesan: ${messageContent}*\n\n`;
    const mentions = participants.map((member) => {
      teks += `⭔ @${member.id.split("@")[0]}\n`;
      return member.id;
    });

    // Kirim pesan dengan mentions
    await sock.sendMessage(
      remoteJid,
      { text: teks, mentions },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error:", error);
    // Tangani error dengan pesan ke pengguna
    await sendTextMessage(
      sock,
      remoteJid,
      `⚠️ Terjadi kesalahan: ${error.message}`,
      message
    );
  }
}

export default {
  handle,
  Commands: ["tagall"],
  OnlyPremium: false,
  OnlyOwner: false,
};
