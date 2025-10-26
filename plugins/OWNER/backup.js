import { createBackup } from "../../lib/utils.js";
import config from "../../config.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message } = messageInfo;
  
  try {
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const backupFilePath = await createBackup();

    await sock.sendMessage(
      remoteJid,
      {
        text: `✅ _Berhasil, data backup telah disimpan dan terkirim ke nomor bot_

Size : ${backupFilePath.size}
Time : ${backupFilePath.time}
`,
      },
      { quoted: message }
    );

    const documentPath = backupFilePath.path;

    await sock.sendMessage(`${config.phone_number_bot}@s.whatsapp.net`, {
      document: { url: documentPath },
      fileName: "File Backup",
      mimetype: "application/zip",
    });
  } catch (err) {
    console.error("Backup failed:", err);

    await sock.sendMessage(
      remoteJid,
      {
        text: `❌ _Gagal melakukan backup:_ ${err.message}`,
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["backup"],
  OnlyPremium: false,
  OnlyOwner: true,
};
