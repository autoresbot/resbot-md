import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";
import { logCustom } from "../../lib/logger.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, prefix, command, content } = messageInfo;

  try {
    // Mengirim reaksi loading
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const api = new ApiAutoresbot(config.APIKEY);

    // Memanggil API berdasarkan konten
    const endpoint = content ? "/api/doa" : "/api/doa/random";
    const params = content ? { q: content } : {};
    const response = await api.get(endpoint, params);

    // Validasi respons API
    if (response?.data?.length) {
      const doaInfo = response.data[0];
      const msgNiatSholat = `_*${doaInfo.doa}*_

${doaInfo.ayat}
${doaInfo.latin}

_${doaInfo.artinya}_`;

      // Mengirim pesan dengan informasi doa
      await sock.sendMessage(
        remoteJid,
        { text: msgNiatSholat },
        { quoted: message }
      );
    } else {
      logCustom("info", content, `ERROR-COMMAND-${command}.txt`);
      // Pesan jika tidak ada data yang ditemukan
      const notFoundMessage =
        `_Doa *${content || "yang Anda cari"}* tidak ditemukan._\n` +
        `_Coba gunakan kata kunci yang lebih spesifik atau pendek._\n\n` +
        `_Misalnya: *${prefix + command} tidur*._`;
      await sock.sendMessage(
        remoteJid,
        { text: notFoundMessage },
        { quoted: message }
      );
    }
  } catch (error) {
    console.error("Error saat memanggil API doa:", error);
    logCustom("info", content, `ERROR-COMMAND-${command}.txt`);

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
  Commands: ["doa"],
  OnlyPremium: false,
  OnlyOwner: false,
};
