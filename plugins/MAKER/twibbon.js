import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";
import mess from "../../strings.js";
import { getProfilePictureUrl } from "../../lib/cache.js";

async function handle(sock, messageInfo) {
  const {
    remoteJid,
    message,
    sender,
    content,
    isQuoted,
    prefix,
    command,
    pushName,
  } = messageInfo;

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
          } 1*_`,
        },
        { quoted: message }
      );
      return; // Hentikan eksekusi jika tidak ada konten
    }

    // Kirimkan pesan loading dengan reaksi emoji
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const ppUser = await getProfilePictureUrl(sock, sender);

    // Buat instance API dan ambil data dari endpoint
    const api = new ApiAutoresbot(config.APIKEY);
    const buffer = await api.getBuffer("/api/maker/twibbon", {
      url: ppUser,
      type: text,
    });

    await sock.sendMessage(
      remoteJid,
      { image: buffer, caption: mess.general.success },
      { quoted: message }
    );
  } catch (error) {
    console.log(error);
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
  Commands: ["twibbon"],
  OnlyPremium: false,
  OnlyOwner: false,
};
