import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";

import { downloadToBuffer, isURL } from "../../lib/utils.js";

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
        } https://twitter.com/gofoodindonesia/status/1229369819511709697*_`
      );
    }

    if (!isURL(content)) {
      return sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        `_⚠️ Link tidak valid_`
      );
    }

    // Tampilkan reaksi "Loading"
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Inisialisasi API
    const api = new ApiAutoresbot(config.APIKEY);

    // Memanggil API dengan parameter
    const response = await api.get("/api/downloader/twitter", {
      url: content,
    });

    // Download file ke buffer
    const audioBuffer = await downloadToBuffer(response.data[0], "mp4");

    // Menangani respons API
    if (response.code === 200 && response.data) {
      await sock.sendMessage(
        remoteJid,
        {
          video: audioBuffer,
          mimetype: "video/mp4",
          caption: mess.general.success,
        },
        { quoted: message }
      );
    } else {
      logCustom("info", content, `ERROR-COMMAND-${command}.txt`);

      // Menangani kasus jika respons tidak sesuai atau kosong
      const errorMessage =
        response?.message ||
        "Maaf, tidak ada respons dari server. Silakan coba lagi nanti.";
      await sendMessageWithQuote(sock, remoteJid, message, errorMessage);
    }
  } catch (error) {
    logCustom("info", content, `ERROR-COMMAND-${command}.txt`);

    // Menangani kesalahan dan mengirim pesan ke pengguna
    const errorMessage = `Maaf, terjadi kesalahan saat memproses permintaan Anda. Mohon coba lagi nanti.\n\nDetail Error: ${
      error.message || error
    }`;
    await sendMessageWithQuote(sock, remoteJid, message, errorMessage);
  }
}

export default {
  handle,
  Commands: ["tw", "twitter"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
