import config from "../../config.js";
import { sendImageAsSticker } from "../../lib/exif.js";
import axios from "axios";

// Peta nama warna ke kode warna
const colorMap = {
  merah: "#FF0000",
  hijau: "#00FF00",
  biru: "#0000FF",
  kuning: "#FFFF00",
  hitam: "#000000",
  putih: "#FFFFFF",
  abu: "#808080",
  jingga: "#FFA500",
  ungu: "#800080",
  pink: "#FFC0CB",
  coklat: "#A52A2A",
};

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
    const text = isQuoted?.text || content;

    // Validasi input konten
    if (!text) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
            prefix + command
          } resbot | warna*_`,
        },
        { quoted: message }
      );
      return; // Hentikan eksekusi jika tidak ada konten
    }

    // Pisahkan teks dan kode/nama warna jika tersedia
    const [text2, bgColorInput] = text.split("|").map((item) => item.trim());

    // Cek apakah warna input adalah nama warna atau kode warna
    const backgroundColor =
      colorMap[bgColorInput?.toLowerCase()] || bgColorInput || "#FFFFFF";

    // Kirimkan pesan loading dengan reaksi emoji
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Ambil URL gambar profil pengguna (fallback jika gagal)
    const ppnyauser = await sock
      .profilePictureUrl(sender, "image")
      .catch(() => "https://telegra.ph/file/6880771a42bad09dd6087.jpg");

    // Konfigurasi JSON untuk API quote
    const json = {
      type: "quote",
      format: "png",
      backgroundColor: backgroundColor,
      width: 700,
      height: 580,
      scale: 2,
      messages: [
        {
          entities: [],
          avatar: true,
          from: {
            id: 1,
            name: pushName,
            photo: {
              url: ppnyauser,
            },
          },
          text: text2,
          replyMessage: {},
        },
      ],
    };

    // Mengirimkan permintaan ke API quote
    const response = await axios.post(
      "https://bot.lyo.su/quote/generate",
      json,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    // Konversi gambar base64 ke buffer
    const buffer = Buffer.from(response.data.result.image, "base64");

    // Kirimkan stiker hasil quote
    const options = {
      packname: config.sticker_packname,
      author: config.sticker_author,
    };
    await sendImageAsSticker(sock, remoteJid, buffer, options, message);
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
  Commands: ["qcstick"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
