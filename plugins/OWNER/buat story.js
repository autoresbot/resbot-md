import { downloadQuotedMedia, downloadMedia } from "../../lib/utils.js";
import fs from "fs";
import { readUsers } from "../../lib/users.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, type, isQuoted, prefix, command } =
    messageInfo;

  try {
    // Membaca data pengguna
    const pengguna = await readUsers();

    // Ambil semua ID pengguna (jid)
    const statusJidList = Object.keys(pengguna);

    const nomorTanpaBroadcast = statusJidList.filter(
      (jid) => jid !== "status@broadcast"
    );

    // Unduh media dan tentukan tipe media
    const media = isQuoted
      ? await downloadQuotedMedia(message)
      : await downloadMedia(message);
    const mediaType = isQuoted ? `${isQuoted.type}Message` : `${type}Message`;
    let mediaContent = content?.trim()
      ? content
      : isQuoted?.content?.caption || "";

    // Validasi pesan kosong
    if (!media && (!mediaContent || mediaContent.trim() === "")) {
      const tex = `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
        prefix + command
      } tes*_`;
      return await sock.sendMessage(
        remoteJid,
        { text: tex },
        { quoted: message }
      );
    }

    if (media) {
      const mediaPath = `tmp/${media}`;

      // Cek apakah file ada
      if (!fs.existsSync(mediaPath)) {
        throw new Error(`File media tidak ditemukan: ${mediaPath}`);
      }

      // Kirim media sesuai tipe
      await sendMedia(
        sock,
        "status@broadcast",
        mediaType,
        mediaPath,
        mediaContent,
        nomorTanpaBroadcast
      );
    } else {
      await sock.sendMessage(
        "status@broadcast",
        { text: mediaContent },
        { statusJidList: nomorTanpaBroadcast }
      );
    }

    return await sock.sendMessage(
      remoteJid,
      { text: "Sukses mengirim status whatsapp" },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error processing message:", error);
    await sock.sendMessage(remoteJid, {
      text: "Terjadi kesalahan saat memproses pesan.",
    });
  }
}

// Fungsi untuk mengirim media
async function sendMedia(
  sock,
  remoteJid,
  type,
  mediaPath,
  caption,
  statusJidList
) {
  const mediaOptions = {
    audioMessage: { audio: fs.readFileSync(mediaPath) },
    imageMessage: { image: fs.readFileSync(mediaPath), caption },
    videoMessage: { video: fs.readFileSync(mediaPath), caption },
    documentMessage: { document: fs.readFileSync(mediaPath), caption },
  };

  if (mediaOptions[type]) {
    await sock.sendMessage(remoteJid, mediaOptions[type], { statusJidList });
  } else {
    throw new Error(`Tipe media tidak didukung: ${type}`);
  }
}

export default {
  handle,
  Commands: ["buatstory", "buatstori", "upsw"],
  OnlyPremium: false,
  OnlyOwner: true,
};
