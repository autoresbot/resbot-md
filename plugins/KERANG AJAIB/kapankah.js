import { sendMessageWithMention } from "../../lib/utils.js";

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

  // Pastikan konten tidak kosong
  if (!content || content.trim() === "") {
    const groupOnlyMessage = {
      text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
        prefix + command
      } aku ganteng*_`,
    };
    return sock.sendMessage(remoteJid, groupOnlyMessage, { quoted: message });
  }

  // Daftar kemungkinan jawaban
  const possibleAnswers = [
    "Besok",
    "Lusa",
    "Tadi",
    "4 Hari Lagi",
    "5 Hari Lagi",
    "6 Hari Lagi",
    "1 Minggu Lagi",
    "2 Minggu Lagi",
    "3 Minggu Lagi",
    "1 Bulan Lagi",
    "2 Bulan Lagi",
    "3 Bulan Lagi",
    "4 Bulan Lagi",
    "5 Bulan Lagi",
    "6 Bulan Lagi",
    "1 Tahun Lagi",
    "2 Tahun Lagi",
    "3 Tahun Lagi",
    "4 Tahun Lagi",
    "5 Tahun Lagi",
    "6 Tahun Lagi",
    "1 Abad lagi",
    "3 Hari Lagi",
  ];

  // Memilih jawaban secara acak dari daftar
  const randomAnswer =
    possibleAnswers[Math.floor(Math.random() * possibleAnswers.length)];

  // Membuat pesan yang akan dikirim
  const responseText = `*Pertanyaan:* ${fullText}\n\n*Jawaban:* ${randomAnswer}`;

  // Mengirim pesan dengan menyebutkan user
  await sendMessageWithMention(
    sock,
    remoteJid,
    responseText,
    message,
    senderType
  );
}

export default {
  handle,
  Commands: ["kapankah"],
  OnlyPremium: false,
  OnlyOwner: false,
};
