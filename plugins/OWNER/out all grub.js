import { groupFetchAllParticipating } from "../../lib/cache.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, command, sender } = messageInfo;

  try {
    // Jika perintah hanya kosong atau hanya spasi
    if (!content.trim()) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ _Perintah ini akan mengeluarkan seluruh grup WhatsApp pada bot._ \n\nSilakan ketik *.${command} -y* untuk melanjutkan.`,
        },
        { quoted: message }
      );
      return;
    }

    // Jika pengguna menyetujui dengan "-y"
    if (content.trim() === "-y") {
      const allGroups = await groupFetchAllParticipating(sock);

      // Looping untuk keluar dari semua grup
      const leavePromises = Object.values(allGroups).map((group) => {
        if (group.id !== remoteJid) {
          return sock.groupLeave(group.id);
        }
        return null;
      });

      // Tunggu semua grup selesai diproses
      await Promise.all(leavePromises);

      await sock.sendMessage(
        remoteJid,
        { text: "✅ _Berhasil keluar dari semua grup. Kecuali Grub Ini_" },
        { quoted: message }
      );
    }
  } catch (error) {
    console.error("Terjadi kesalahan:", error);

    // Kirim pesan kesalahan
    await sock.sendMessage(
      remoteJid,
      { text: "⚠️ Terjadi kesalahan saat memproses permintaan Anda." },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: [
    "outallgrup",
    "outallgroup",
    "outallgrub",
    "outallgroub",
    "outallgc",
  ],
  OnlyPremium: false,
  OnlyOwner: true,
};
