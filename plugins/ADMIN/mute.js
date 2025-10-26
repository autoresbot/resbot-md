import { findGroup, updateGroup } from "../../lib/group.js";
import mess from "../../strings.js";
import { getGroupMetadata } from "../../lib/cache.js";

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender, command } = messageInfo;
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

    // Cari data grup berdasarkan ID
    const dataGroup = await findGroup(remoteJid);
    if (!dataGroup) {
      throw new Error("Data grup tidak ditemukan.");
    }

    // Respon berdasarkan perintah
    let responseText = "";
    let updateData = false;

    if (command === "mute") {
      updateData = { fitur: { ["mute"]: true } };
      responseText = mess.action.mute;
    } else if (command === "unmute") {
      updateData = { fitur: { ["mute"]: false } };
      responseText = mess.action.unmute;
    } else {
      responseText = "_Perintah tidak dikenali._";
    }

    // Perbarui data grup jika perintah valid
    if (updateData) {
      await updateGroup(remoteJid, updateData);
    }

    // Kirim pesan ke grup
    await sock.sendMessage(
      remoteJid,
      { text: responseText },
      { quoted: message }
    );
  } catch (error) {
    // Tangani kesalahan
    console.error(error.message);
    await sock.sendMessage(
      remoteJid,
      { text: "Terjadi kesalahan saat memproses perintah. Silakan coba lagi." },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["mute", "unmute"],
  OnlyPremium: false,
  OnlyOwner: false,
};
