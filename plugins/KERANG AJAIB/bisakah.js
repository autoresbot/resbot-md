import fs from "fs";
import path from "path";
import { textToAudio } from "../../lib/features.js";
import {
  convertAudioToCompatibleFormat,
  generateUniqueFilename,
  sendMessageWithMention,
} from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const {
    remoteJid,
    message,
    fullText,
    content,
    mentionedJid,
    prefix,
    command,
    senderType,
  } = messageInfo;

  // Pastikan konten tidak kosong
  if (!content || content.trim() === "") {
    const groupOnlyMessage = {
      text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
        prefix + command
      } kucing terbang*_`,
    };
    return sock.sendMessage(remoteJid, groupOnlyMessage, { quoted: message });
  }

  // Daftar kemungkinan jawaban
  const possibleAnswers = [
    "Bisa",
    "Tidak Bisa",
    "Mana Gua Tau",
    "Mungkin",
    "Tentu Saja",
    "Tidak Pasti",
    "Tentu Tidak",
    "Tidak Mungkin",
    "Tidak",
  ];

  // Memilih jawaban secara acak dari daftar
  const randomAnswer =
    possibleAnswers[Math.floor(Math.random() * possibleAnswers.length)];

  // Membuat pesan yang akan dikirim
  const responseText = `*Pertanyaan:* ${fullText}\n\n*Jawaban:* ${randomAnswer}`;

  try {
    const bufferAudio = await textToAudio(randomAnswer);

    const baseDir = process.cwd();
    const inputPath = path.join(baseDir, generateUniqueFilename());
    fs.writeFileSync(inputPath, bufferAudio);

    let bufferOriginal = bufferAudio;

    try {
      bufferOriginal = await convertAudioToCompatibleFormat(inputPath);
    } catch {}
    await sock.sendMessage(
      remoteJid,
      { audio: { url: bufferOriginal }, mimetype: "audio/mp4" },
      { quoted: message }
    );
  } catch (error) {
    // Mengirim pesan dengan menyebutkan user
    await sendMessageWithMention(
      sock,
      remoteJid,
      responseText,
      message,
      senderType
    );
  }
}
export default {
  handle,
  Commands: ["bisakah"],
  OnlyPremium: false,
  OnlyOwner: false,
};
