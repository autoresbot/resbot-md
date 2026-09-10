import { groupFetchAllParticipating } from "../../lib/cache.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message } = messageInfo;

  try {
    // Kirim reaksi sementara untuk memberikan feedback
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Ambil semua grup yang diikuti
    const allGroups = await groupFetchAllParticipating(sock);

    // Hitung total grup
    const totalGroups = Object.keys(allGroups).length;

    // Hitung jumlah grup komunitas dan grup biasa
    let totalCommunities = 0;
    let totalRegularGroups = 0;

    // Hitung jumlah grup terbuka dan tertutup
    let totalOpenGroups = 0;
    let totalClosedGroups = 0;

    for (const groupId in allGroups) {
      const group = allGroups[groupId];

      // Hitung komunitas
      if (group.isCommunity) {
        totalCommunities++;
      } else {
        totalRegularGroups++;
      }

      // Hitung grup terbuka dan tertutup
      if (group.announce) {
        totalClosedGroups++;
      } else {
        totalOpenGroups++;
      }
    }

    // Kirim hasil perhitungan ke pengguna
    await sock.sendMessage(
      remoteJid,
      {
        text: `*_Statistik Grup:_*\n
◧ Total Grup: *${totalGroups}*
◧ Grup Komunitas: *${totalCommunities}*
◧ Grup Biasa: *${totalRegularGroups}*
◧ Grup Terbuka: *${totalOpenGroups}*
◧ Grup Tertutup: *${totalClosedGroups}*`,
      },
      { quoted: message }
    );
  } catch (error) {
    // Kirim log error dan berikan feedback pada pengguna jika diperlukan
    console.error("Error in handle function:", error);
    await sock.sendMessage(
      remoteJid,
      { text: "_Terjadi kesalahan saat memproses perintah._" },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["totalgc", "totalgrub", "totalgroub", "totalgrup", "totalgroup"],
  OnlyPremium: false,
  OnlyOwner: true,
};
