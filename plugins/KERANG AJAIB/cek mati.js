import { sendMessageWithMention, convertToJid, extractNumber } from '../../lib/utils.js';

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
        text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${prefix + command} @TAG*_`,
      },
      { quoted: message },
    );
  }

  // Tentukan nama dan usia secara acak
  const random_cekmati = Math.floor(Math.random() * 31) + 20; // Umur antara 20 dan 50

  const mentionedNumber = extractNumber(mentionedJid[0]);
  const numberJid = await convertToJid(sock, mentionedNumber);

  // Format pesan dengan teks yang lebih menarik dan informatif
  const responseText = `🔮 *Nama:* ${command} @${numberJid.split('@')[0]}\n🕒 *Mati Pada Umur:* ${random_cekmati} Tahun\n\n⚠️ _Cepet-cepet Tobat, karena mati itu tak ada yang tahu!_`;

  try {
    // Kirim pesan dengan format yang lebih jelas
    // Kirim pesan dengan mention
    await sendMessageWithMention(sock, remoteJid, responseText, message, senderType);
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

export default {
  handle,
  Commands: ['cekmati'],
  OnlyPremium: false,
  OnlyOwner: false,
};
