import config from "../../config.js";
import { sendMessageWithMention, extractNumber } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const {
    remoteJid,
    message,
    fullText,
    sender,
    content,
    mentionedJid,
    prefix,
    command,
    senderType,
  } = messageInfo;

  // Pastikan ada orang yang ditandai
  if (!mentionedJid?.length) {
    return sock.sendMessage(
      remoteJid,
      {
        text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
          prefix + command
        } @TAG*_`,
      },
      { quoted: message }
    );
  }

  // Cek apakah yang ditandai adalah owner
  // Ambil number dari mention pertama
  const mentionedNumber = extractNumber(mentionedJid[0]);

  // Cek apakah number tersebut ada di config.owner_number
  const isOwner =
    mentionedNumber && config.owner_number.includes(mentionedNumber);

  // Tentukan array kemungkinan jawaban
  const gan = isOwner
    ? ["83", "97", "100", "102", "120", "9999", "127", "86"] // Jawaban spesial untuk owner
    : [
        "10",
        "30",
        "20",
        "40",
        "50",
        "60",
        "70",
        "62",
        "74",
        "83",
        "97",
        "100",
        "29",
        "94",
        "75",
        "82",
        "41",
        "39",
      ]; // Jawaban standar

  // Pilih jawaban secara acak
  const selectedAnswer = gan[Math.floor(Math.random() * gan.length)];

  // Format pesan dengan menyebutkan user yang ditandai
  const responseText = `*Pertanyaan:* ${fullText}\n\n*Jawaban:* ${selectedAnswer}`;

  try {
    // Kirim pesan dengan menyebutkan orang yang ditandai
    await sendMessageWithMention(
      sock,
      remoteJid,
      responseText,
      message,
      senderType
    );
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

export default {
  handle,
  Commands: ["cekcantik"],
  OnlyPremium: false,
  OnlyOwner: false,
};
