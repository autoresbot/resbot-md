import fs from "fs";
import { exec } from "child_process";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function handle(sock, messageInfo) {
  const { remoteJid, message } = messageInfo;

  try {
    // Kirim pesan reaksi sebagai tanda proses dimulai
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Buat file restaring.txt dengan nama pengirim (remoteJid)
    fs.writeFile("restaring.txt", remoteJid, (err) => {
      if (err) {
        console.error("Terjadi kesalahan saat membuat file:", err);
        return;
      }
    });

    await sleep(2000);

    exec(`node index`);
  } catch (error) {
    console.error("Terjadi kesalahan:", error);
  }
}

export default {
  handle,
  Commands: ["restart"],
  OnlyPremium: false,
  OnlyOwner: true,
};
