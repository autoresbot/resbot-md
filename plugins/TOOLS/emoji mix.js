import { reply, fetchJson, getBuffer } from "../../lib/utils.js";
import { sendImageAsSticker } from "../../lib/exif.js";
import sharp from "sharp";

import config from "../../config.js";

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, prefix, command, content } = messageInfo;

  try {
    // Validasi input
    if (!content || !content.includes("+")) {
      return await reply(m, `_*Contoh:*_ ${prefix + command} 😅+🤔`);
    }

    let [emoji1, emoji2] = content.split("+").map((e) => e.trim());
    if (!emoji1 || !emoji2) {
      return await reply(m, `_*Contoh:*_ ${prefix + command} 😅+🤔`);
    }

    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Ambil data dari API Emoji Kitchen

    const apiResponse = await fetchJson(
      `https://tenor.googleapis.com/v2/featured?key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v5&q=${encodeURIComponent(
        emoji1.trim()
      )}_${encodeURIComponent(emoji2.trim())}`
    );

    if (
      !apiResponse ||
      !apiResponse.results ||
      apiResponse.results.length === 0
    ) {
      throw new Error(
        `Tidak ditemukan hasil untuk kombinasi emoji ${emoji1} dan ${emoji2}.`
      );
    }
    const imageUrl = apiResponse.results[0].url;
    const imageBuffer = await getBuffer(imageUrl);
    const webpBuffer = await sharp(imageBuffer).webp().toBuffer();

    // Kirim stiker
    const options = {
      packname: config.sticker_packname,
      author: config.sticker_author,
    };
    await sendImageAsSticker(sock, remoteJid, webpBuffer, options, message);
  } catch (error) {
    console.error("Kesalahan di fungsi handle:", error);
    const errorMessage = error.message || "Terjadi kesalahan tak dikenal.";
    return await reply(m, `_Error: ${errorMessage}_`);
  }
}

export default {
  handle,
  Commands: ["emojimix"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
