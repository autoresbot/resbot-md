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

    // Memanggil API hadits
    const response = await api.get("/api/hadits");

    // Validasi respons
    if (
      response?.data &&
      response.data.judul &&
      response.data.arab &&
      response.data.indo
    ) {
      const dataHadist =
        `📖 *${response.data.judul}*\n\n` +
        `🔹 *Arab:*\n${response.data.arab}\n\n` +
        `🔸 *Terjemahan:*\n${response.data.indo}`;

      // Mengirim data hadits ke pengguna
      await sock.sendMessage(
        remoteJid,
        { text: dataHadist },
        { quoted: message }
      );
    } else {
      console.warn("Respons API tidak sesuai:", response?.data);

      // Pesan jika data kosong
      const noDataMessage =
        "Maaf, tidak ada data hadits yang tersedia saat ini. Coba lagi nanti.";
      await sock.sendMessage(
        remoteJid,
        { text: noDataMessage },
        { quoted: message }
      );
    }
  } catch (error) {
    console.error("Error saat memanggil API hadits:", error);

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
  Commands: ["hadis", "hadist", "hadits"],
  OnlyPremium: false,
  OnlyOwner: false,
};
