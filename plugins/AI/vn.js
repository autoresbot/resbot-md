import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import fs from "fs/promises";
import path from "path";
import config from "../../config.js";
import { textToAudio } from "../../lib/features.js";
import { logCustom } from "../../lib/logger.js";
import {
  convertAudioToOpus,
  generateUniqueFilename,
} from "../../lib/utils.js";

/**
 * Ambil audio TTS. Utamakan /api/tts, kalau gagal baru fallback ke textToAudio.
 * @param {string} text
 * @returns {Promise<Buffer|null>}
 */
async function getVoiceBuffer(text) {
  try {
    const api = new ApiAutoresbot(config.APIKEY);
    const buffer = await api.getBuffer("/api/tts", { text });
    if (buffer?.length) return buffer;
  } catch (err) {
    console.warn("[VN] /api/tts gagal:", err.message);
  }

  try {
    const buffer = await textToAudio(text);
    if (buffer?.length) return buffer;
  } catch (err) {
    console.warn("[VN] fallback textToAudio gagal:", err.message);
  }

  return null;
}

/**
 * Konversi ke opus (format asli VN WhatsApp).
 * Konversi bersifat opsional: kalau gagal, audio asli tetap dipakai.
 * @param {Buffer} buffer
 * @returns {Promise<Buffer>}
 */
async function toOpus(buffer) {
  const inputPath = path.join(process.cwd(), generateUniqueFilename());
  let outputPath = null;

  try {
    await fs.writeFile(inputPath, buffer);
    outputPath = await convertAudioToOpus(inputPath);
    return await fs.readFile(outputPath);
  } catch (err) {
    console.warn("[VN] Konversi ke opus gagal, pakai audio asli:", err.message);
    return buffer;
  } finally {
    await Promise.all(
      [inputPath, outputPath]
        .filter(Boolean)
        .map((file) => fs.unlink(file).catch(() => {}))
    );
  }
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command, isQuoted } =
    messageInfo;

  const text = content?.trim() || isQuoted?.text?.trim() || null;

  try {
    if (!text) {
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

    const bufferOriginal = await getVoiceBuffer(text);

    if (!bufferOriginal) {
      return await sock.sendMessage(
        remoteJid,
        { text: "_⚠️ Gagal mengubah teks menjadi suara. Coba lagi nanti._" },
        { quoted: message }
      );
    }

    const bufferFinal = await toOpus(bufferOriginal);

    return await sock.sendMessage(
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
