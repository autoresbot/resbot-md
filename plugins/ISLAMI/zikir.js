import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message } = messageInfo;

  try {
    // Mengirim reaksi loading
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const api = new ApiAutoresbot(config.APIKEY);

    // Memanggil API zikir random
    const response = await api.get("/api/islami/zikir");

    // Validasi dan pemformatan respons
    if (response?.data) {
      const zikirMessage = `_*Zikir Harian*_:\n\n${response.data}`;
      await sock.sendMessage(
        remoteJid,
        { text: zikirMessage },
        { quoted: message }
      );
    } else {
      // Pesan jika data kosong
      const noDataMessage =
        "Maaf, tidak ada data zikir yang tersedia saat ini. Coba lagi nanti.";
      await sock.sendMessage(
        remoteJid,
        { text: noDataMessage },
        { quoted: message }
      );
    }
  } catch (error) {
    console.error("Error saat memanggil API Zikir:", error);

    // Pesan kesalahan kepada pengguna
    const errorMessage = `Maaf, terjadi kesalahan saat memproses permintaan Anda. Coba lagi nanti.\n\nDetail Kesalahan: ${error.message}`;
    await sock.sendMessage(
      remoteJid,
      { text: errorMessage },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["zikir"],
  OnlyPremium: false,
  OnlyOwner: false,
};
