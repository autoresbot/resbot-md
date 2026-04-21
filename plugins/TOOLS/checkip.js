import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";

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
  const { remoteJid, message, prefix, command, content } = messageInfo;

  try {
    // Validasi input
    if (!content.trim() || content.trim() == "") {
      return sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _${
          prefix + command
        } 66.249.66.207_`
      );
    }

    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const api = new ApiAutoresbot(config.APIKEY);

    // Memanggil API dengan parameter
    const response = await api.get("/api/stalker/ip", {
      ip: content,
    });

    if (response && response.data) {
      // Mengubah data menjadi string
      const responseDataString = JSON.stringify(response.data, null, 2); // null dan 2 untuk format yang lebih rapi
      return await sock.sendMessage(
        remoteJid,
        { text: `${responseDataString}` },
        { quoted: message }
      );
    } else {
      // Jika tidak ada data
      return await sock.sendMessage(
        remoteJid,
        { text: "Tidak ada data yang ditemukan dari API." },
        { quoted: message }
      );
    }
  } catch (error) {
    console.error("Kesalahan di fungsi handle:", error);

    const errorMessage = error.message || "Terjadi kesalahan tak dikenal.";
    return await sock.sendMessage(
      remoteJid,
      { text: `_Error: ${errorMessage}_` },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["ipcheck", "checkip", "cekip", "ipchecker"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
