import { listSewa } from "../../lib/sewa.js";
import { groupFetchAllParticipating } from "../../lib/cache.js";

async function handle(sock, messageInfo) {
  const { remoteJid } = messageInfo;

  try {
    // Ambil semua data sewa
    const sewa = await listSewa();

    // Ambil semua grup yang bot ikuti
    const allGroups = await groupFetchAllParticipating(sock);

    let count = 0;
    let listMessage = "*▧ 「 LIST GRUP NON-SEWA 」*\n\n";

    // Iterasi semua grup
    for (const [groupId, groupData] of Object.entries(allGroups)) {
      if (!sewa[groupId]) {
        listMessage += `╭─
│ Subject : ${groupData.subject}
│ ID Grup : ${groupId}
╰────────────────────────\n`;
        count++;
      }
    }

    listMessage += `\n*Total : ${count}*`;

    if (count === 0) {
      listMessage = "✅ _Semua grup merupakan grup sewa._";
    }

    await sock.sendMessage(remoteJid, {
      text: listMessage,
    });
  } catch (error) {
    await sock.sendMessage(remoteJid, {
      text: "_Terjadi kesalahan saat mengambil data grup non-sewa._",
    });
  }
}

export default {
  handle,
  Commands: ["listnosewa"],
  OnlyPremium: false,
  OnlyOwner: true,
};
