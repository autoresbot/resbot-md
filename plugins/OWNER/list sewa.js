import { listSewa } from "../../lib/sewa.js";
import { selisihHari } from "../../lib/utils.js";
import { groupFetchAllParticipating } from "../../lib/cache.js";

async function handle(sock, messageInfo) {
  const { remoteJid, sender, message } = messageInfo;

  try {
    // Ambil data list berdasarkan grup
    const sewa = await listSewa();

    // Jika tidak ada list
    if (!sewa || Object.keys(sewa).length === 0) {
      await sock.sendMessage(remoteJid, {
        text: "⚠️ _Tidak Ada daftar sewa ditemukan_",
      });
      return;
    }

    // Konversi objek ke array dan urutkan berdasarkan waktu expired terbaru
    const sortedSewa = Object.entries(sewa).sort(
      ([, a], [, b]) => a.expired - b.expired
    );

    const allGroups = await groupFetchAllParticipating(sock);

    // Buat daftar untuk ditampilkan
    let listMessage = "*▧ 「 LIST SEWA* 」\n\n";
    sortedSewa.forEach(([groupId, data], index) => {
      // Ambil subject dari allGroups jika ada
      const subject = allGroups[groupId]
        ? allGroups[groupId].subject
        : "Nama Grup Tidak Ditemukan";

      listMessage += `╭─
│ Subject : ${subject}
│ ID Grup : ${groupId}
│ Expired : ${selisihHari(data.expired)}
╰────────────────────────\n`;
    });

    listMessage += `\n*Total : ${sortedSewa.length}*`;

    // Kirim pesan daftar sewa
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
  Commands: ["listsewa"],
  OnlyPremium: false,
  OnlyOwner: true,
};
