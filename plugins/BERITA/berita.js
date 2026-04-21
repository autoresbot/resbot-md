import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";
import { logCustom } from "../../lib/logger.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, command, content } = messageInfo;

  try {
    // Reaksi saat memproses
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Instance API
    const api = new ApiAutoresbot(config.APIKEY);

    // Panggil endpoint berita sesuai command
    const response = await api.get(`/api/news/${command}`);

    const posts = response?.data?.posts;
    if (!posts || posts.length === 0) {
      logCustom("info", content, `ERROR-COMMAND-${command}.txt`);
      return await sock.sendMessage(
        remoteJid,
        { text: "Maaf, tidak ada respons dari server." },
        { quoted: message }
      );
    }

    const { title, description, link, thumbnail: image } = posts[0];
    const caption = `${title}\n\n${description}\n${link}`;

    // Kirim pesan dengan gambar jika ada, jika tidak hanya teks
    const messagePayload = image
      ? { image: { url: image }, caption }
      : { text: caption };

    await sock.sendMessage(remoteJid, messagePayload, { quoted: message });
  } catch (error) {
    console.error("Error handle news command:", error);
    logCustom("info", content, `ERROR-COMMAND-${command}.txt`);

    await sock.sendMessage(
      remoteJid,
      { text: "_⚠️ Gagal: Periksa Apikey Anda! (.apikey)_" },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: [
    "antara",
    "cnn",
    "cnbc",
    "jpnn",
    "kumparan",
    "merdeka",
    "okezone",
    "republika",
    "sindonews",
    "tempo",
  ],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
