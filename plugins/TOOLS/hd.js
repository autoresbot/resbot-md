import { downloadQuotedMedia, downloadMedia, reply } from "../../lib/utils.js";
import fs from "fs";
import path from "path";
import mess from "../../strings.js";
import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";

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
    const MediaBuffer = await api.getBuffer("/api/tools/remini", { url });

    if (!Buffer.isBuffer(MediaBuffer)) {
      throw new Error("Invalid response: Expected Buffer.");
    }

    if (response && MediaBuffer) {
      await sock.sendMessage(
        remoteJid,
        {
          image: MediaBuffer,
          caption: mess.general.success,
        },
        { quoted: message }
      );
    } else {
      const errorMessage = `_Terjadi kesalahan saat upload ke gambar._ \n\nERROR : ${error}`;
      await reply(m, errorMessage);
    }
  } catch (error) {
    // Kirim pesan kesalahan yang lebih informatif
    const errorMessage = `_Terjadi kesalahan saat memproses gambar._ \n_Periksa apikey anda ketik .apikey_\n\nERROR : ${error}`;
    await reply(m, errorMessage);
  }
}

export default {
  handle,
  Commands: ["hd", "remini"], // Perintah yang diproses oleh handler ini
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
