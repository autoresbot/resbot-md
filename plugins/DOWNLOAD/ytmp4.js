import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";
import mess from "../../strings.js";
import { logCustom } from "../../lib/logger.js";
import { extractLink, downloadToBuffer } from "../../lib/utils.js";

async function sendMessageWithQuote(sock, remoteJid, message, text) {
  await sock.sendMessage(remoteJid, { text }, { quoted: message });
}

// Fungsi helper untuk delay (jeda)
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fungsi untuk mencoba request API hingga 3 kali
async function fetchWithRetry(api, endpoint, params, maxRetries = 3, delayMs = 5000) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await api.get(endpoint, params);
      if (response && response.status) return response;
      throw new Error(`API response invalid (attempt ${attempt})`);
    } catch (err) {
      lastError = err;
      console.warn(`Percobaan ke-${attempt} gagal: ${err.message}`);
      if (attempt < maxRetries) {
        console.log(`Menunggu ${delayMs / 1000} detik sebelum mencoba lagi...`);
        await delay(delayMs);
      }
    }
  }
  throw lastError;
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;
  const validLink = extractLink(content);

  try {
    if (!content.trim() || content.trim() === "") {
      return sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
          prefix + command
        } https://www.youtube.com/watch?v=xxxxx*_`
      );
    }

    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const api = new ApiAutoresbot(config.APIKEY);

    // Gunakan fetchWithRetry agar mencoba 3x dengan jeda 5 detik
    const response = await fetchWithRetry(api, "/api/downloader/ytmp4", { url: validLink }, 3, 5000);

    if (response.status) {
      const url_media = response.data.url;
      const videoBuffer = await downloadToBuffer(url_media, "mp4");

      await sock.sendMessage(
        remoteJid,
        {
          video: videoBuffer,
          caption: mess.general.success,
        },
        { quoted: message }
      );
    } else {
      logCustom("info", content, `ERROR-COMMAND-${command}.txt`);
      await sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        "Maaf, tidak dapat menemukan video dari URL yang Anda berikan."
      );
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
  Commands: ["ytmp4"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
