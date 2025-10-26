import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import fs from "fs/promises";
import path from "path";
import config from "../../config.js";
import { textToAudio } from "../../lib/features.js";
import { logCustom } from "../../lib/logger.js";
import {
  convertAudioToCompatibleFormat,
  convertAudioToOpus,
  generateUniqueFilename,
} from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command, isQuoted } =
    messageInfo;

  const text =
    content && content.trim() !== "" ? content : isQuoted?.text ?? null;

  try {
    if (!text || text.trim().length < 1) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
            prefix + command
          } halo google*_`,
        },
        { quoted: message }
      );
    }

    // Loading
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    let bufferOriginal = await textToAudio(text);

    if (!bufferOriginal) {
      const api = new ApiAutoresbot(config.APIKEY);
      bufferOriginal = await api.getBuffer("/api/tts", { text: text });
    }

    const inputPath = path.join(process.cwd(), generateUniqueFilename());
    await fs.writeFile(inputPath, bufferOriginal);

    let bufferFinal = bufferOriginal; // Default menggunakan bufferOriginal

    try {
      const convertedPath = await convertAudioToOpus(inputPath);
      bufferFinal = await fs.readFile(convertedPath);
    } catch (err) {}

    await sock.sendMessage(
      remoteJid,
      {
        audio: bufferFinal,
        mimetype: "audio/mp4",
        ptt: true,
      },
      { quoted: message }
    );
  } catch (error) {
    logCustom("error", text, `ERROR-COMMAND-${command}.txt`);

    return await sock.sendMessage(
      remoteJid,
      {
        text: `_⚠️ Gagal: Periksa Apikey Anda! (.apikey)_`,
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["vn"],
  OnlyPremium: false,
  OnlyOwner: false,
};
