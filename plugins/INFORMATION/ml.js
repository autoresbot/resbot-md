import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";
import { logCustom } from "../../lib/logger.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, prefix, command, content } = messageInfo;

  try {
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return await sock.sendMessage(
        remoteJid,
        { text: `_Masukkan ID GAME_\n\n${prefix + command} 427679814 9954` },
        { quoted: message }
      );
    }

    const [user_id, server] = trimmedContent.split(" ");

    if (!user_id || !server) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ _Format salah. Gunakan:_\n\n${
            prefix + command
          } <user_id> <server>`,
        },
        { quoted: message }
      );
    }

    // Mengirimkan reaksi loading
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const api = new ApiAutoresbot(config.APIKEY);

    // Memanggil API
    const response = await api.get("/api/stalker/ml", { user_id, server });

    if (response?.data) {
      const { username, this_login_country, region} = response.data;

      const gameDataId = `🎮 | *MOBILE LEGEND*

◧ User ID : ${user_id}
◧ Server : ${server}
◧ Username : ${username || "Tidak diketahui"}
◧ Country : ${this_login_country || region || "Tidak tersedia"}`;

      // Mengirimkan data yang diperoleh
      await sock.sendMessage(
        remoteJid,
        { text: gameDataId },
        { quoted: message }
      );
    } else {
      logCustom("info", content, `ERROR-COMMAND-${command}.txt`);
      // Respons kosong atau tidak ada data
      await sock.sendMessage(
        remoteJid,
        { text: "Maaf, tidak ada respons dari server." },
        { quoted: message }
      );
    }
  } catch (error) {
    console.error("Error:", error);
    logCustom("info", content, `ERROR-COMMAND-${command}.txt`);

    // Penanganan kesalahan dengan pesan ke pengguna
    await sock.sendMessage(
      remoteJid,
      {
        text: `Maaf, terjadi kesalahan saat memproses permintaan Anda. Coba lagi nanti.\n\nDetail: ${
          error.message || error
        }`,
      },
      { quoted: message }
    );
  }
}
export default {
  handle,
  Commands: ["ml", "mlcek"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
