// file: textpro.js (ESM version)

// Import ESM style
import ApiAutoresbotModule from "api-autoresbot";
import config from "../../config.js";
import mess from "../../strings.js";
import { logCustom } from "../../lib/logger.js";

// Pastikan ambil default atau named export
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

export async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;
  try {
    // Validasi input konten
    if (!content) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
            prefix + command
          } resbot*_`,
        },
        { quoted: message }
      );
      return; // Hentikan eksekusi jika tidak ada konten
    }

    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const api = new ApiAutoresbot(config.APIKEY);
    const buffer = await api.getBuffer(`/api/textpro/${command}`, {
      text: content,
      orientasi: "potrait",
    });

    await sock.sendMessage(
      remoteJid,
      { image: buffer, caption: mess.general.success },
      { quoted: message }
    );
  } catch (error) {
    logCustom("info", content, `ERROR-COMMAND-${command}.txt`);
    await sock.sendMessage(
      remoteJid,
      {
        text: `_⚠️ Gagal: Periksa Apikey Anda! (.apikey)_`,
      },
      { quoted: message }
    );
  }
}

// Export konfigurasi lain
export const Commands = [
  "3dbox",
  "blackpink",
  "boom",
  "gaming",
  "magma",
  "matrix",
  "metal",
  "neon",
  "shadow",
  "signature",
  "sliced",
  "snow",
  "valentine",
  "winter",
  "wolf",
];

export const OnlyPremium = false;
export const OnlyOwner = false;
export const limitDeduction = 1; // Jumlah limit yang akan dikurangi
