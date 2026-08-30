import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import { textToAudio } from "../../lib/features.js";
import config from "../../config.js";
import { logCustom } from "../../lib/logger.js";

const api = new ApiAutoresbot(config.APIKEY);

/**
 * Ambil audio TTS. Utamakan /api/tts, kalau gagal baru fallback ke textToAudio.
 * @param {string} text
 * @returns {Promise<Buffer|null>}
 */
async function getVoiceBuffer(text) {
  try {
    const buffer = await api.getBuffer("/api/tts", { text });
    if (buffer?.length) return buffer;
  } catch (err) {
    console.warn("[VOICEAI] /api/tts gagal:", err.message);
  }

  try {
    const buffer = await textToAudio(text);
    if (buffer?.length) return buffer;
  } catch (err) {
    console.warn("[VOICEAI] fallback textToAudio gagal:", err.message);
  }

  return null;
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, prefix, command, content } = messageInfo;

  try {
    if (!content?.trim()) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
            prefix + command
          } penemu facebook*_`,
        },
        { quoted: message }
      );
    }

    // Loading
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Jawaban AI dibuat sesingkat mungkin agar aman untuk TTS
    const contentShort = `${content} dan tulis sesingkat mungkin`;
    const response = await api.get("/api/gemini", { text: contentShort });

    if (!response?.data) {
      return await sock.sendMessage(
        remoteJid,
        { text: "Maaf, tidak ada respons dari server." },
        { quoted: message }
      );
    }

    const bufferAudio = await getVoiceBuffer(response.data);

    if (!bufferAudio) {
      return await sock.sendMessage(
        remoteJid,
        { text: "_⚠️ Gagal mengubah teks menjadi suara. Coba lagi nanti._" },
        { quoted: message }
      );
    }

    return await sock.sendMessage(
      remoteJid,
      { audio: bufferAudio, mimetype: "audio/mp4" },
      { quoted: message }
    );
  } catch (error) {
    logCustom("info", content, `ERROR-COMMAND-${command}.txt`);

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
  Commands: ["voiceai"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
