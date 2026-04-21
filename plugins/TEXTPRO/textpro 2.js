// file: textpro2.js (ESM version)

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
    // Validasi input konten minimal 2 kata
    if (!content || content.trim().split(/\s+/).length < 2) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
            prefix + command
          } auto | resbot*_ \n\n_Minimal 2 kata_`,
        },
        { quoted: message }
      );
      return; // Hentikan eksekusi jika tidak ada konten atau konten kurang dari 2 kata
    }

    // Memeriksa apakah ada tanda '|' dalam content
    let text1, text2;
    if (content.includes("|")) {
      // Jika ada '|', pisahkan berdasarkan '|'
      [text1, text2] = content.split("|").map((item) => item.trim());
    } else {
      // Jika tidak ada '|', pisahkan berdasarkan spasi
      const [first, ...rest] = content.split(" ");
      text1 = first;
      text2 = rest.join(" ");
    }

    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const api = new ApiAutoresbot(config.APIKEY);
    const buffer = await api.getBuffer(`/api/textpro/${command}`, {
      text1,
      text2,
    });

    await sock.sendMessage(
      remoteJid,
      { image: buffer, caption: mess.general.success },
      { quoted: message }
    );
  } catch (error) {
    logCustom("info", content, `ERROR-COMMAND-TEXTPRO-${command}.txt`);
    await sock.sendMessage(
      remoteJid,
      {
        text: `_⚠️ Gagal: Periksa Apikey Anda! (.apikey)_`,
      },
      { quoted: message }
    );
  }
}

export const Commands = ["marvel", "pornhub"];
export const OnlyPremium = false;
export const OnlyOwner = false;
export const limitDeduction = 1; // Jumlah limit yang akan dikurangi
