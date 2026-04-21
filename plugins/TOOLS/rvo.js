import { downloadQuotedMedia, reply } from "../../lib/utils.js";

import fs from "fs";
import path from "path";
import mess from "../../strings.js";

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, sender, prefix, command, type, isQuoted } =
    messageInfo;

  try {
    const mediaType = isQuoted ? isQuoted.type : type;
    if (mediaType !== "viewonce" || !isQuoted) {
      return await reply(
        m,
        `⚠️ _Balas media sekali lihat dengan caption *${prefix + command}*_`
      );
    }

    // Tampilkan reaksi "Loading"
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Download
    const media = await downloadQuotedMedia(message);
    const mediaPath = path.join("tmp", media);

    if (!fs.existsSync(mediaPath)) {
      throw new Error("File media tidak ditemukan setelah diunduh.");
    }

    // Membaca file menjadi Buffer
    const mediaBuffer = fs.readFileSync(mediaPath);

    if (isQuoted?.rawMessageType === "audioMessage") {
      await sock.sendMessage(
        remoteJid,
        {
          audio: mediaBuffer,
          mimetype: "audio/mp4",
          ptt: true,
        },
        { quoted: message }
      );
      return;
    }

    if (isQuoted?.rawMessageType === "imageMessage") {
      await sock.sendMessage(
        remoteJid,
        {
          image: mediaBuffer,
          caption: mess.general.success,
        },
        { quoted: message }
      );
      return;
    }

    if (isQuoted?.rawMessageType === "videoMessage") {
      await sock.sendMessage(
        remoteJid,
        { video: mediaBuffer, caption: mess.general.success },
        { quoted: message }
      );
      return;
    }
  } catch (error) {
    console.error("Kesalahan saat memproses perintah Hd:", error);

    // Kirim pesan kesalahan yang lebih informatif
    const errorMessage = `_Terjadi kesalahan saat memproses gambar._`;
    await reply(m, errorMessage);
  }
}

export default {
  handle,
  Commands: ["rvo"],
  OnlyPremium: true,
  OnlyOwner: false,
};
