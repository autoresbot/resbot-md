import { reply, fetchJson, getBuffer } from "../../lib/utils.js";
import { sendImageAsSticker } from "../../lib/exif.js";
import sharp from "sharp";
import config from "../../config.js";

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, prefix, command, content } = messageInfo;

  try {
    if (!content || !content.includes("+")) {
      return await reply(m, `_*contoh:*_ ${prefix + command} 🍞+🤕`);
    }

    let [emoji1, emoji2] = content.split("+").map((e) => e.trim());
    if (!emoji1 || !emoji2) {
      return await reply(m, `_*contoh:*_ ${prefix + command} 🍞+🤕`);
    }

    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const apiKey = "AIzaSyACvEq5cnT7AcHpDdj64SE3TJZRhW-iHuo";
    const query = `${encodeURIComponent(emoji1)}_${encodeURIComponent(emoji2)}`;
    const apiUrl = `https://tenor.googleapis.com/v2/featured?key=${apiKey}&client_key=emoji_kitchen_funbox&q=${query}&collection=emoji_kitchen_v6&contentfilter=high`;

    const apiResponse = await fetchJson(apiUrl);

    if (
      !apiResponse ||
      !apiResponse.results ||
      apiResponse.results.length === 0
    ) {
      const reverseQuery = `${encodeURIComponent(emoji2)}_${encodeURIComponent(emoji1)}`;
      const reverseApiUrl = `https://tenor.googleapis.com/v2/featured?key=${apiKey}&client_key=emoji_kitchen_funbox&q=${reverseQuery}&collection=emoji_kitchen_v6&contentfilter=high`;
      const reverseResponse = await fetchJson(reverseApiUrl);

      if (!reverseResponse || !reverseResponse.results || reverseResponse.results.length === 0) {
        throw new Error(`kombinasi emoji ${emoji1} dan ${emoji2} belum didukung oleh google emoji kitchen.`);
      }
      
      apiResponse.results = reverseResponse.results;
    }

    const imageUrl = apiResponse.results[0].url; 
    const imageBuffer = await getBuffer(imageUrl);
    const webpBuffer = await sharp(imageBuffer).webp().toBuffer();

    const options = {
      packname: config.sticker_packname,
      author: config.sticker_author,
    };
    await sendImageAsSticker(sock, remoteJid, webpBuffer, options, message);

  } catch (error) {
    console.error("kesalahan di fungsi handle:", error);
    const errorMessage = error.message || "terjadi kesalahan tak dikenal saat mengambil emoji.";
    return await reply(m, `_error: ${errorMessage}_`);
  }
}

export default {
  handle,
  Commands: ["emojimix"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};