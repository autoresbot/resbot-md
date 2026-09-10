import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";
import mess from "../../strings.js";

// Fungsi untuk buat angka acak dalam range
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Fungsi untuk format waktu "HH:mm"
function randomTime(baseDate = new Date()) {
  let hour = randomInt(0, 23);
  let minute = randomInt(0, 59);
  return `${hour.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")}`;
}

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
          } resbot*_`,
        },
        { quoted: message }
      );
      return;
    }

    // Kirimkan pesan loading dengan reaksi emoji
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Fungsi format waktu WIB (GMT+7)
    function getWaktuIndonesia() {
      const date = new Date();
      // Ubah ke GMT+7
      const options = { timeZone: "Asia/Jakarta", hour12: false };
      const formatter = new Intl.DateTimeFormat("id-ID", {
        ...options,
        hour: "2-digit",
        minute: "2-digit",
      });
      return formatter.format(date);
    }

    // Di dalam handle():
    const chatTime = getWaktuIndonesia();
    const statusBarTime = getWaktuIndonesia();

    // Random value
    const batteryLevel = randomInt(5, 100).toString(); // antara 5% - 100%

    // Buat instance API dan ambil data dari endpoint
    const api = new ApiAutoresbot(config.APIKEY);
    const buffer = await api.getBuffer("/api/maker/iqc", {
      text,
      chatTime,
      statusBarTime,
      batteryLevel,
      operator: "Telkomsel 4G",
      language: "ID", // ID & EN
    });

    await sock.sendMessage(
      remoteJid,
      {
        image: buffer,
        caption: `${mess.general.success}`,
      },
      { quoted: message }
    );
  } catch (error) {
    console.log(error);
    const errorMessage = `Maaf, terjadi kesalahan saat memproses permintaan Anda. Coba lagi nanti.\n\nError: ${error.message}`;
    await sock.sendMessage(
      remoteJid,
      { text: errorMessage },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["iqc"],
  OnlyPremium: false,
  OnlyOwner: false,
};
