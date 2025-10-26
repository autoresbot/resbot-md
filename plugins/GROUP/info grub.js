import fs from "fs";
import path from "path";
import { getGroupMetadata } from "../../lib/cache.js";

function getGroupSchedule(filePath) {
  if (!fs.existsSync(filePath)) return { openTime: "-", closeTime: "-" };

  const schedules = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  let openTime = "-";
  let closeTime = "-";

  for (const groupData of Object.values(schedules)) {
    openTime = groupData.openTime ?? openTime;
    closeTime = groupData.closeTime ?? closeTime;
  }

  return { openTime, closeTime };
}

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message } = messageInfo;
  if (!isGroup) return; // Only Grub

  try {
    // Mendapatkan metadata grup
    const groupMetadata = await getGroupMetadata(sock, remoteJid);

    const jsonPath = path.resolve(
      process.cwd(),
      "./database/additional/group participant.json"
    );
    const { openTime, closeTime } = getGroupSchedule(jsonPath);

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
