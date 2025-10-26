import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;
import config from "../../config.js";
import { sendImageAsSticker } from "../../lib/exif.js";
import { logCustom } from "../../lib/logger.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, isQuoted, prefix, command } =
    messageInfo;

  try {
    const text =
      content && content.trim() !== "" ? content : isQuoted?.text ?? null;

    // Validasi input konten
    if (!text) {
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

    // Kirimkan pesan loading dengan reaksi emoji
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Bersihkan konten
    const sanitizedContent = encodeURIComponent(
      text.trim().replace(/\n+/g, " ")
    );

    // Buat instance API dan ambil data dari endpoint
    const api = new ApiAutoresbot(config.APIKEY);

    let buffer = false;
    try {
      buffer = await api.getBuffer("/api/maker/brat", {
        text: sanitizedContent,
      });
    } catch (e) {
      buffer = false;
    }

    const options = {
      packname: config.sticker_packname,
      author: config.sticker_author,
    };

    if (buffer) {
      // Kirim stiker
      await sendImageAsSticker(sock, remoteJid, buffer, options, message);
    } else {
      await sock.sendMessage(
        remoteJid,
        {
          text: "Ada kesalahan periksa apikey anda, ketik .apikey",
        },
        { quoted: message }
      );
    }
  } catch (error) {
    logCustom("info", content, `ERROR-COMMAND-${command}.txt`);
    // Tangani kesalahan dan kirimkan pesan error ke pengguna
    const errorMessage = `Maaf, terjadi kesalahan saat memproses permintaan Anda. Coba lagi nanti.\n\nError: ${error.message}`;
    await sock.sendMessage(
      remoteJid,
      {
        text: errorMessage,
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["brat"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
