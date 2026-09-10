import config from "../../config.js";
import { sendImageAsSticker } from "../../lib/exif.js";
import { quote } from "../../lib/scrape/quote.js";

async function handle(sock, messageInfo) {
  const {
    remoteJid,
    sender,
    message,
    content,
    isQuoted,
    prefix,
    command,
    pushName,
  } = messageInfo;

  try {
    const text = content ?? isQuoted?.text ?? null;

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

    // Ambil URL gambar profil pengguna (fallback jika gagal)
    const ppnyauser = await sock
      .profilePictureUrl(sender, "image")
      .catch(() => "https://telegra.ph/file/6880771a42bad09dd6087.jpg");

    // Generate hasil dari API quote
    const rest = await quote(text, pushName, ppnyauser);

    // Kirimkan stiker hasil quote
    const options = {
      packname: config.sticker_packname,
      author: config.sticker_author,
    };
    await sendImageAsSticker(sock, remoteJid, rest.result, options, message);
  } catch (error) {
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
  Commands: ["qc2"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
