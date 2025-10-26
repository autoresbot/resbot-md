import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, prefix, command, content } = messageInfo;

  // Ikon loading untuk menunjukkan proses sedang berjalan
  const loadingReaction = { react: { text: "⏰", key: message.key } };
  const errorMessage =
    "Maaf, terjadi kesalahan saat memproses permintaan Anda. Coba lagi nanti.";

  try {
    // Mengirim reaksi loading
    await sock.sendMessage(remoteJid, loadingReaction);

    const api = new ApiAutoresbot(config.APIKEY);

    // Memanggil endpoint API untuk mendapatkan informasi gempa
    const response = await api.get(`/api/information/gempadirasakan`);

    // Validasi respons dari API
    if (response?.data?.length) {
      const gempaInfo = response.data[0];
      const capt = `_*Info Gempa Terbaru*_

*◧ Tanggal:* ${gempaInfo.Tanggal}
*◧ Wilayah:* ${gempaInfo.Wilayah}
*◧ DateTime:* ${gempaInfo.DateTime}
*◧ Lintang:* ${gempaInfo.Lintang}
*◧ Bujur:* ${gempaInfo.Bujur}
*◧ Magnitude:* ${gempaInfo.Magnitude}
*◧ Kedalaman:* ${gempaInfo.Kedalaman}
*◧ Dirasakan:* ${gempaInfo.Dirasakan || "Tidak ada informasi dirasakan"}
`;

      // Mengirim informasi gempa kepada pengguna
      await sock.sendMessage(remoteJid, { text: capt }, { quoted: message });
    } else {
      // Mengirim pesan default jika data tidak tersedia
      await sock.sendMessage(
        remoteJid,
        { text: "Maaf, tidak ada informasi gempa saat ini." },
        { quoted: message }
      );
    }
  } catch (error) {
    console.error("Error saat memanggil API gempa:", error);

    // Menangani error dan mengirim pesan ke pengguna
    await sock.sendMessage(
      remoteJid,
      { text: `${errorMessage}\n\nDetail Kesalahan: ${error.message}` },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["infogempa"],
  OnlyPremium: false,
  OnlyOwner: false,
};
