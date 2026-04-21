// Edit Subject: Mengganti Judul Grup

import mess from "../../strings.js";
import { getGroupMetadata } from "../../lib/cache.js";

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender, content, prefix, command } =
    messageInfo;
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

    // Validasi input
    if (!content.trim() || content.trim() == "") {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
            prefix + command
          } judul baru*_`,
        },
        { quoted: message }
      );
    }

    // Perbarui judul grup
    await sock.groupUpdateSubject(remoteJid, content);

    // Kirim pesan keberhasilan
    await sock.sendMessage(
      remoteJid,
      {
        text: `✅ _Nama grup berhasil diganti!_`,
      },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error in edit subject command:", error);

    // Kirim pesan kesalahan
    await sock.sendMessage(
      remoteJid,
      {
        text: "⚠️ Terjadi kesalahan saat mencoba mengganti nama grup. Pastikan format benar dan Anda memiliki izin.",
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["editsubjek", "editsubject", "editsubjeck", "editjudul"],
  OnlyPremium: false,
  OnlyOwner: false,
};
