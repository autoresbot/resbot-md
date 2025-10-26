import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import fs from "fs";
import path from "path";
import mess from "../../strings.js";
import config from "../../config.js";

import { downloadQuotedMedia, downloadMedia, reply } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, content, prefix, command, type, isQuoted } =
    messageInfo;

  try {
    const mediaType = isQuoted ? isQuoted.type : type;
    if (mediaType !== "image") {
      return await reply(
        m,
        `⚠️ _Kirim/Balas gambar dengan caption *${prefix + command}*_`
      );
    }

    // Tampilkan reaksi "Loading"
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Download & Upload media
    const media = isQuoted
      ? await downloadQuotedMedia(message)
      : await downloadMedia(message);
    const mediaPath = path.join("tmp", media);

    if (!fs.existsSync(mediaPath)) {
      throw new Error("File media tidak ditemukan setelah diunduh.");
    }

    const api = new ApiAutoresbot(config.APIKEY);
    const response = await api.tmpUpload(mediaPath);

    if (!response || response.code !== 200) {
      throw new Error("File upload gagal atau tidak ada URL.");
    }
    const url = response.data.url;
    const MediaBuffer = await api.getBuffer("/api/maker/wanted", { url });

    if (!Buffer.isBuffer(MediaBuffer)) {
      throw new Error("Invalid response: Expected Buffer.");
    }

    await sock.sendMessage(
      remoteJid,
      {
        image: MediaBuffer,
        caption: mess.general.success,
      },
      { quoted: message }
    );
  } catch (error) {
    console.error("Kesalahan saat memproses perintah Hd:", error);

    // Kirim pesan kesalahan yang lebih informatif
    const errorMessage = `_Terjadi kesalahan saat memproses gambar._`;
    await reply(m, errorMessage);
  }
}
export default {
  handle,
  Commands: ["wanted"], // Perintah yang diproses oleh handler ini
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
