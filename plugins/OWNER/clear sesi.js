import fs from "fs";
import path from "path";

async function handle(sock, messageInfo) {
  const { remoteJid, message } = messageInfo;

  try {
    const sessionPath = path.join(process.cwd(), "session");
    if (!fs.existsSync(sessionPath)) {
      return await sock.sendMessage(
        remoteJid,
        { text: `⚠️ Folder sesi tidak ditemukan.` },
        { quoted: message }
      );
    }

    let sessions = fs
      .readdirSync(sessionPath)
      .filter((a) => a !== "creds.json");

    if (sessions.length === 0) {
      return await sock.sendMessage(
        remoteJid,
        { text: `✅ Tidak ada sesi yang perlu dihapus.` },
        { quoted: message }
      );
    }

    sessions.forEach((file) => {
      fs.unlinkSync(path.join(sessionPath, file));
    });

    await sock.sendMessage(
      remoteJid,
      { text: `✅ Semua sesi telah dihapus.` },
      { quoted: message }
    );
  } catch (error) {
    console.error("Terjadi kesalahan:", error);
    await sock.sendMessage(
      remoteJid,
      { text: `⚠️ Terjadi kesalahan saat memproses perintah.` },
      { quoted: message }
    );
  }
}
export default {
  handle,
  Commands: ["clearsesi"],
  OnlyPremium: false,
  OnlyOwner: true,
};
