import moment from "moment-timezone";

async function handle(sock, messageInfo) {
  const { remoteJid, message } = messageInfo;

  // Format waktu dan tanggal
  const format = "DD-MM-YYYY HH:mm";

  // Waktu Internasional (UTC)
  const utcTime = moment().tz("UTC").format(format);

  // Waktu Server (menggunakan waktu lokal dari sistem server)
  const serverTime = moment().format(format);

  // Waktu WIB (Asia/Jakarta)
  const jakartaTime = moment().tz("Asia/Jakarta").format(format);

  // Mengirim pesan dengan tiga zona waktu
  const response = `⏰ Waktu Saat Ini:
    
🌍 UTC: 
${utcTime}

🖥 Server: 
${serverTime}

🇮🇩 WIB: 
${jakartaTime}`;

  return await sock.sendMessage(
    remoteJid,
    { text: response },
    { quoted: message }
  );
}

export default {
  handle,
  Commands: ["now"],
  OnlyPremium: false,
  OnlyOwner: false,
};
