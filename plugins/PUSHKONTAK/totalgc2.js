import { groupFetchAllParticipating } from "../../lib/cache.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message } = messageInfo;

  try {
    // Kirim reaksi sementara untuk memberikan feedback
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const allGroups = await groupFetchAllParticipating(sock);
    let totalCommunities = 0;
    let totalRegularGroups = 0;

    for (const groupId in allGroups) {
      const group = allGroups[groupId];
      // Hitung komunitas
      if (group.isCommunity) {
        totalCommunities++;
      } else {
        totalRegularGroups++;
      }
    }
    await sock.sendMessage(remoteJid, {
      text: `◧ Total Grup: *${totalRegularGroups}*`,
    });
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
  Commands: [
    "totalgc2",
    "totalgrub2",
    "totalgroub2",
    "totalgrup2",
    "totalgroup2",
  ],
  OnlyPremium: false,
  OnlyOwner: true,
};
