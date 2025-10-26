import axios from "axios";

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, sender } = messageInfo;

  const domain = "https://www.google.com";

  try {
    // Kondisi pertama: Jika tidak ada content, hanya mengembalikan response time lokal
    if (!content) {
      const startTime = process.hrtime();
      const endTime = process.hrtime(startTime);
      const kecepatanResponS = endTime[0] + endTime[1] / 1e9;

      await sock.sendMessage(
        remoteJid,
        {
          text: `⌬ _Response Time :_ ${kecepatanResponS.toFixed(6)} s`,
        },
        { quoted: message }
      );
      return;
    }

    // Kondisi kedua: Jika ada content, melakukan ping ke domain
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const startTime = process.hrtime();
    await axios.get(domain);
    const endTime = process.hrtime(startTime);
    const kecepatanResponS = endTime[0] + endTime[1] / 1e9;

    await sock.sendMessage(
      remoteJid,
      {
        text: `⌬ _Response Time :_ ${kecepatanResponS.toFixed(
          6
        )} s\n⌬ _Ping :_ ${domain}`,
      },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error in ping handler:", error);

    await sock.sendMessage(
      remoteJid,
      { text: "Maaf, terjadi kesalahan saat melakukan ping. Coba lagi nanti!" },
      { quoted: message }
    );
  }
}
export default {
  handle,
  Commands: ["ping"],
  OnlyPremium: false,
  OnlyOwner: false,
};
