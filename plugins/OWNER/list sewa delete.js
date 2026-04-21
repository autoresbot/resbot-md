import { listSewa, deleteSewa } from "../../lib/sewa.js";
import { selisihHari } from "../../lib/utils.js";
import { groupFetchAllParticipating } from "../../lib/cache.js";

async function handle(sock, messageInfo) {
  const { remoteJid } = messageInfo;

  try {
    const sewa = await listSewa();

    if (!sewa || Object.keys(sewa).length === 0) {
      await sock.sendMessage(remoteJid, {
        text: "⚠️ _Tidak ada daftar sewa ditemukan_",
      });
      return;
    }

    const sortedSewa = Object.entries(sewa).sort(
      ([, a], [, b]) => a.expired - b.expired
    );
    const allGroups = await groupFetchAllParticipating(sock);

    let listMessage = "*▧ 「 LIST SEWA 」*\n\n";
    let count = 0;

    for (const [groupId, data] of sortedSewa) {
      const subject =
        allGroups[groupId]?.subject || "Nama Grup Tidak Ditemukan";

      if (subject === "Nama Grup Tidak Ditemukan") {
        // Hapus data sewa berdasarkan ID grup
        await deleteSewa(groupId);
        continue;
      }

      listMessage += `╭─
│ Subject : ${subject}
│ ID Grup : ${groupId}
│ Expired : ${selisihHari(data.expired)}
╰────────────────────────\n`;

      count++;
    }

    listMessage += `\n*Total : ${count}*`;

    await sock.sendMessage(remoteJid, {
      text: listMessage,
    });
  } catch (error) {
    await sock.sendMessage(remoteJid, {
      text: "_Terjadi kesalahan saat mengambil daftar sewa_",
    });
  }
}

export default {
  handle,
  Commands: ["listsewa2"],
  OnlyPremium: false,
  OnlyOwner: true,
};
