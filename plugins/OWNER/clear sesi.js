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

    // Di era Baileys, sesi tersebar jadi ribuan file *.json dan creds.json
    // cukup dilindungi sendirian. Di zapo SELURUH state ada di zapo.sqlite,
    // jadi tanpa pengecualian ini perintah ini akan menghapus sesi bot
    // sepenuhnya dan memaksa pairing ulang.
    const PROTECTED = ["creds.json", "zapo.sqlite", "zapo.sqlite-wal", "zapo.sqlite-shm"];

    let sessions = fs
      .readdirSync(sessionPath)
      .filter((a) => !PROTECTED.includes(a))
      // Folder sesi jadibot tidak boleh ikut terhapus oleh unlinkSync.
      .filter((a) => fs.statSync(path.join(sessionPath, a)).isFile());

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
