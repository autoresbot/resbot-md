import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";
import { logCustom } from "../../lib/logger.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, prefix, command, content } = messageInfo;

  try {
    const trimmedContent = content.trim();

    // Validasi input pengguna
    if (!trimmedContent) {
      return await sendErrorMessage(
        sock,
        remoteJid,
        `_Masukkan Username TikTok_\n\nContoh: _${prefix + command} kompascom_`,
        message
      );
    }

    const user_id = trimmedContent;

    // Mengirim reaksi loading
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Inisialisasi API dan memanggil endpoint
    const api = new ApiAutoresbot(config.APIKEY);
    const response = await api.get("/api/stalker/tiktok", {
      username: user_id,
    });

    // Validasi respons API
    if (response?.data) {
      const { nickname, desc, avatar, follower, following } = response.data;

      const resultTiktok = `
*STALKER TIKTOK*

◧ *Username*: ${user_id || "Tidak diketahui"}
◧ *Nickname*: ${nickname || "Tidak diketahui"}
◧ *Deskripsi*: ${desc || "Tidak diketahui"}
◧ *Follower*: ${follower || "Tidak diketahui"}
◧ *Following*: ${following || "Tidak diketahui"}
`;

      try {
        // Kirim gambar jika avatar ada dan valid
        if (Array.isArray(avatar) && avatar[0]) {
          return await sock.sendMessage(
            remoteJid,
            { image: { url: avatar[0] }, caption: resultTiktok },
            { quoted: message }
          );
        }
      } catch (error) {
        //console.warn("Gagal mengirim gambar avatar:", error.message || error);
      }

      // Kirim teks jika avatar gagal atau tidak ada
      return await sock.sendMessage(
        remoteJid,
        { text: resultTiktok },
        { quoted: message }
      );
    }

    logCustom("info", content, `ERROR-COMMAND-${command}.txt`);
    // Jika respons tidak ada data
    await sendErrorMessage(
      sock,
      remoteJid,
      "Maaf, tidak ada data pengguna TikTok yang ditemukan.",
      message
    );
  } catch (error) {
    console.error("Error:", error);
    logCustom("info", content, `ERROR-COMMAND-${command}.txt`);

    // Penanganan kesalahan dengan pesan ke pengguna
    await sendErrorMessage(
      sock,
      remoteJid,
      `Maaf, terjadi kesalahan saat memproses permintaan Anda. Coba lagi nanti.\n\n*Detail*: ${
        error.message || error
      }`,
      message
    );
  }
}

// Fungsi utilitas untuk mengirim pesan kesalahan
async function sendErrorMessage(sock, remoteJid, text, quotedMessage) {
  await sock.sendMessage(remoteJid, { text }, { quoted: quotedMessage });
}

export default {
  handle,
  Commands: ["stalktiktok"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
