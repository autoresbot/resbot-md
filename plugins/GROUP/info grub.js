import { getGroupMetadata } from "../../lib/cache.js";
import { getDb, safeJsonParse } from "../../lib/database.js";

function getGroupSchedule(remoteJid) {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM participants WHERE id = ?').get(remoteJid);
    if (!row) return { openTime: "-", closeTime: "-" };

    const data = safeJsonParse(row.data, {});
    return {
      openTime: data.openTime ?? "-",
      closeTime: data.closeTime ?? "-",
    };
  } catch {
    return { openTime: "-", closeTime: "-" };
  }
}

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message } = messageInfo;
  if (!isGroup) return; // Only Grub

  try {
    // Mendapatkan metadata grup
    const groupMetadata = await getGroupMetadata(sock, remoteJid);

    const { openTime, closeTime } = getGroupSchedule(remoteJid);

    let response = await sock.groupInviteCode(remoteJid);
    let text = `┏━『 *${groupMetadata.subject}* 』━◧
┣
┣» Anggota : ${groupMetadata.size}
┣» ID  : ${groupMetadata.id}
┣» Link : https://chat.whatsapp.com/${response}
┣
┣ *SCHEDULED*
┣» Open Grub  : ${openTime}
┣» Close Grub  : ${closeTime}
┗━━━━━━━━━━━━━◧
`;

    // Kirim pesan keberhasilan
    await sock.sendMessage(remoteJid, { text }, { quoted: message });
  } catch (error) {
    // Kirim pesan kesalahan
    await sock.sendMessage(
      remoteJid,
      {
        text: "⚠️ Terjadi kesalahan saat Mendapatkan Info Grub. Pastikan format benar dan Bot memiliki izin.",
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["infogc", "infogrub", "infogroub", "infogrup", "infogroup"],
  OnlyPremium: false,
  OnlyOwner: false,
};
