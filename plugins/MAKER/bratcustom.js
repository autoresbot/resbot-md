import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;
import config from "../../config.js";
import { sendImageAsSticker } from "../../lib/exif.js";
import { logCustom } from "../../lib/logger.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, isQuoted, prefix, command } =
    messageInfo;

  try {
    const textContent = content ?? isQuoted?.text ?? null;

    const args = textContent?.trim().split("|") || [];
    let [textColor, bgColor, ...textParts] = args;

    const basicColors = {
      merah: "ff0000",
      biru: "0000ff",
      hijau: "008000",
      kuning: "ffff00",
      hitam: "000000",
      putih: "ffffff",
      ungu: "800080",
      oranye: "ffa500",
      abuabu: "808080",
      coklat: "8b4513",
      merahmuda: "ffc0cb",
      birutua: "00008b",
      birumuda: "87ceeb",
      hijautua: "006400",
      hijaumuda: "90ee90",
      emas: "ffd700",
      perak: "c0c0c0",
      cyan: "00ffff",
      magenta: "ff00ff",
      lavender: "e6e6fa",
      coral: "ff7f50",
      navy: "000080",
      teal: "008080",
      lime: "00ff00",
      violet: "ee82ee",
      crimson: "dc143c",
      khaki: "f0e68c",
      salmon: "fa8072",
      chocolate: "d2691e",
      tan: "d2b48c",
      sienna: "a0522d",
      beige: "f5f5dc",
      turquoise: "40e0d0",
      indigo: "4b0082",
      slateblue: "6a5acd",
      maroon: "800000",
      olive: "808000",
      mint: "98ff98",
      ivory: "fffff0",
      peach: "ffdab9",
      aquamarine: "7fffd4",
      wheat: "f5deb3",
      plum: "dda0dd",
      orchid: "da70d6",
    };

    // Cek jika warna termasuk dalam daftar
    textColor = basicColors[textColor?.toLowerCase()] || textColor;
    bgColor = basicColors[bgColor?.toLowerCase()] || bgColor;

    const text = textParts.join(" ").trim();

    // Validasi input
    if (!text) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
            prefix + command
          } merah|biru|resbot*_`,
        },
        { quoted: message }
      );
      return;
    }

    // Kirimkan pesan loading dengan reaksi emoji
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Bersihkan konten teks
    const sanitizedContent = encodeURIComponent(text.replace(/\n+/g, " "));

    // Buat instance API dan ambil data dari endpoint
    const api = new ApiAutoresbot(config.APIKEY);
    const buffer = await api.getBuffer("/api/maker/brat", {
      text: sanitizedContent,
      textColor,
      bgColor,
    });

    const options = {
      packname: config.sticker_packname,
      author: config.sticker_author,
    };

    // Kirim stiker
    await sendImageAsSticker(sock, remoteJid, buffer, options, message);
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
  Commands: ["bratcustom"],
  OnlyPremium: false,
  OnlyOwner: false,
};
