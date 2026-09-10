import { listSewa } from "../../lib/sewa.js";
import { groupFetchAllParticipating } from "../../lib/cache.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handle(sock, messageInfo) {
  const { remoteJid } = messageInfo;

  try {
    const sewa = await listSewa();
    const allGroups = await groupFetchAllParticipating(sock);

    let count = 0;
    let listMessage = "*▧ 「 LIST GRUP NON-SEWA 」*\n\n";

    for (const [groupId, groupData] of Object.entries(allGroups)) {
      if (!sewa[groupId]) {
        try {
          await sock.groupLeave(groupId);
          await sleep(2000); // Delay 2 detik agar tidak spam
          listMessage += `╭───────────────
│ *Subject* : ${groupData.subject}
│ *ID Grup* : ${groupId}
╰───────────────\n\n`;
          count++;
        } catch (leaveErr) {
          console.error(`Gagal keluar dari grup ${groupId}:`, leaveErr.message);
          listMessage += `⚠️ *Gagal keluar dari grup: ${groupData.subject} (${groupId})*\n\n`;
        }
      }
    }

    if (count === 0) {
      listMessage = "✅ _Semua grup merupakan grup sewa._";
    } else {
      listMessage += `*Total keluar: ${count} grup.*`;
    }

    await sock.sendMessage(remoteJid, { text: listMessage });
  } catch (error) {
    await sock.sendMessage(remoteJid, {
      text: "_Terjadi kesalahan saat mengambil data grup non-sewa._",
    });
  }
}

export default {
  handle,
  Commands: ["outnosewa"],
  OnlyPremium: false,
  OnlyOwner: true,
};
