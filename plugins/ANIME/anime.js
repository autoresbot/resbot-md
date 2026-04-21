import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;
import config from "../../config.js";
import mess from "../../strings.js";
import { getBuffer } from "../../lib/utils.js";
import sharp from "sharp";
import { logCustom } from "../../lib/logger.js";

let Jimp; // lazy import supaya nggak makan resource kalau nggak perlu

async function safeImageConvert(buffer) {
  try {
    const metadata = await sharp(buffer).metadata();

    // Kalau file valid (jpeg/png/webp)
    if (["jpeg", "png", "webp"].includes(metadata.format)) return buffer;

    // Kalau gif → konversi ke jpeg
    if (metadata.format === "gif") {
      return await sharp(buffer).toFormat("jpeg").toBuffer();
    }

    throw new Error("Format gambar tidak dikenali.");
  } catch (err) {
    console.warn("⚠️ Sharp gagal, fallback ke Jimp:", err.message);
    try {
      if (!Jimp) {
        const jimpModule = await import("jimp");
        Jimp = jimpModule.default || jimpModule;
      }
      const jimpImage = await Jimp.read(buffer);
      return await jimpImage.getBufferAsync(Jimp.MIME_JPEG);
    } catch (jimpErr) {
      throw new Error(
        `Gagal memproses gambar (Sharp & Jimp gagal): ${jimpErr.message}`
      );
    }
  }
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, command, content } = messageInfo;

  try {
    // React sementara proses
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const api = new ApiAutoresbot(config.APIKEY);

    const response = await api
      .get("/api/anime", { method: command })
      .catch(() => null);

    if (!response || !response.data) {
      logCustom("warn", content, `NO-DATA-${command}.txt`);
      return await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Gagal: Periksa Apikey Anda! (.apikey)_`,
        },
        { quoted: message }
      );
    }

    // Ambil buffer dengan validasi ekstra
    let buffer;
    try {
      buffer = await getBuffer(response.data);
      if (!buffer || buffer.length < 10)
        throw new Error("Buffer kosong atau tidak valid.");
    } catch (bufErr) {
      logCustom("error", bufErr.message, `BUFFER-ERROR-${command}.txt`);
      return await sock.sendMessage(
        remoteJid,
        { text: "⚠️ Gagal memuat gambar dari server." },
        { quoted: message }
      );
    }

    const imageBuffer = await safeImageConvert(buffer);

    await sock.sendMessage(
      remoteJid,
      {
        image: imageBuffer,
        caption: mess.general.success || "✅ Berhasil memproses gambar!",
      },
      { quoted: message }
    );

    logCustom("info", `Command: ${command}`, `COMMAND-SUCCESS-${command}.txt`);
  } catch (error) {
    console.error("❌ Error di handler anime:", error);

    logCustom("error", error.message, `ERROR-COMMAND-${command}.txt`);

    await sock.sendMessage(
      remoteJid,
      {
        text: `❌ Terjadi kesalahan saat memproses permintaan.\n\nError: ${error.message}`,
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: [
    "waifu",
    "neko",
    "shinobu",
    "megumin",
    "bully",
    "cuddle",
    "cry",
    "hug",
    "awoo",
    "kiss",
    "lick",
    "pat",
    "smug",
    "bonk",
    "yeet",
    "blush",
    "smile",
    "wave",
    "highfive",
    "handhold",
    "nom",
    "bite",
    "glomp",
    "slap",
    "kill",
    "happy",
    "wink",
    "poke",
    "dance",
    "cringe",
  ],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
