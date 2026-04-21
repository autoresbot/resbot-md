import { tiktokSearch } from "../../lib/scrape/tiktok.js";
import { logCustom } from "../../lib/logger.js";
import { downloadToBuffer } from "../../lib/utils.js";

async function sendMessageWithQuote(sock, remoteJid, message, text) {
  await sock.sendMessage(remoteJid, { text }, { quoted: message });
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;

  try {
    // Validasi input: pastikan konten ada
    if (!content.trim() || content.trim() == "") {
      return sendMessageWithQuote(
        sock,
        remoteJid,
        message,
        `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
          prefix + command
        } kucing lucu*_`
      );
    }

    // Tampilkan reaksi "Loading"
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Memanggil API untuk mendapatkan data video TikTok
    const response = await tiktokSearch(content);

    // Download file ke buffer
    const audioBuffer = await downloadToBuffer(response.no_watermark, "mp4");

    // Mengirim video tanpa watermark dan caption
    await sock.sendMessage(
      remoteJid,
      {
        video: audioBuffer,
        caption: response.title,
      },
      { quoted: message }
    );
  } catch (error) {
    console.error("Kesalahan saat memproses perintah TikTok:", error);
    logCustom("info", content, `ERROR-COMMAND-${command}.txt`);
    // Kirim pesan kesalahan yang lebih informatif
    const errorMessage = `Maaf, terjadi kesalahan saat memproses permintaan Anda. Mohon coba lagi nanti.\n\n*Detail Kesalahan:* ${
      error.message || error
    }`;
    await sendMessageWithQuote(sock, remoteJid, message, errorMessage);
  }
}

export default {
  handle,
  Commands: ["tiktoksearch", "ttsearch", "tts"], // Menentukan perintah yang diproses oleh handler ini
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
