import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";

import { getBuffer } from "../../lib/utils.js";
import mess from "../../strings.js";
import { logCustom } from "../../lib/logger.js";

async function sendMessageWithQuote(
  sock,
  remoteJid,
  message,
  text,
  options = {}
) {
  await sock.sendMessage(remoteJid, { text }, { quoted: message, ...options });
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;

  try {
    // Validasi input
    if (!content.trim() || content.trim() == "") {
      return sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
          prefix + command
        } kucing*_`
      );
    }

    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const api = new ApiAutoresbot(config.APIKEY);

    const response = await api.get("/api/search/pinterest", { text: content });

    if (response.code === 200 && response.data) {
      const buffer = await getBuffer(response.data);
      return await sock.sendMessage(
        remoteJid,
        { image: buffer, caption: mess.general.success },
        { quoted: message }
      );
    } else {
      logCustom("info", content, `ERROR-COMMAND-${command}.txt`);
      const errorMessage =
        response?.message ||
        "Maaf, tidak ada respons dari server. Silakan coba lagi nanti.";
      return await sendMessageWithQuote(sock, remoteJid, message, errorMessage);
    }
  } catch (error) {
    logCustom("info", content, `ERROR-COMMAND-${command}.txt`);
    const errorMessage = `Maaf, terjadi kesalahan saat memproses permintaan Anda. Mohon coba lagi nanti.\n\nDetail Error: ${
      error.message || error
    }`;
    await sendMessageWithQuote(sock, remoteJid, message, errorMessage);
  }
}

export default {
  handle,
  Commands: ["image", "img"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
