import config from "../../config.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message } = messageInfo;
  const rateLimitSeconds = config.rate_limit / 1000; // Konversi ke detik

  const response = `⏱️ *Rate Limit Bot*

🕒 _Batas waktu penggunaan perintah_: *${rateLimitSeconds} detik*

📌 *Mengapa ada batasan ini?*
Untuk menjaga agar bot tidak mengirim terlalu banyak pesan dalam waktu singkat dan menghindari spam. Oleh karena itu, setiap perintah baru dapat diproses setelah jeda ${rateLimitSeconds} detik.

🙏 Terima kasih atas pengertiannya!`;

  await sock.sendMessage(remoteJid, { text: response }, { quoted: message });
}

export default {
  handle,
  Commands: ["ratelimit"],
  OnlyPremium: false,
  OnlyOwner: false,
};
