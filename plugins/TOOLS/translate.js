import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";
import { logCustom } from "../../lib/logger.js";
import { reply } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, content, prefix, command } = messageInfo;

  if (!content) {
    await reply(
      m,
      `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
        prefix + command
      } aku dari indonesia*_`
    );
    return;
  }

  try {
    // Tampilkan reaksi saat proses berlangsung
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Inisialisasi API
    const api = new ApiAutoresbot(config.APIKEY);

    // Jalankan dua permintaan API secara paralel
    const [data1, data2] = await Promise.all([
      api.get("/api/translate/en-id", { text: content }),
      api.get("/api/translate/id-en", { text: content }),
    ]);

    // Kirim hasil terjemahan
    await reply(m, `◧ Indonesia: ${data1.data}\n\n◧ English: ${data2.data}`);
  } catch (error) {
    console.error("Error in translation handler:", error);
    logCustom("info", content, `ERROR-COMMAND-${command}.txt`);
    await sock.sendMessage(
      remoteJid,
      { text: "Maaf, terjadi kesalahan. Coba lagi nanti!" },
      { quoted: message }
    );
  }
}
export default {
  handle,
  Commands: ["ts", "translate"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
