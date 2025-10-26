import { getGroupMetadata } from "../../lib/cache.js";
import { downloadQuotedMedia, downloadMedia } from "../../lib/utils.js";
import fs from "fs";
import path from "path";

async function handle(sock, messageInfo) {
  const {
    remoteJid,
    message,
    content,
    sender,
    prefix,
    command,
    isQuoted,
    type,
  } = messageInfo;

  try {
    // Validasi input kosong atau tidak sesuai format
    if (!content || content.trim() === "") {
      return sendErrorMessage(sock, remoteJid, message, prefix, command);
    }

    // Pisahkan ID Group dan pesan dari konten
    const [idgc, pesangc] = content
      .trim()
      .split("|")
      .map((part) => part.trim());

    if (!idgc || !pesangc) {
      return sendErrorMessage(sock, remoteJid, message, prefix, command);
    }

    // Tampilkan reaksi sementara untuk memproses
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Ambil metadata grup
    const groupMetadata = await getGroupMetadata(sock, idgc).catch(() => null);
    if (!groupMetadata) {
      return await sock.sendMessage(
        remoteJid,
        { text: `⚠️ ID Group tidak valid atau grup tidak ditemukan.` },
        { quoted: message }
      );
    }

    const participants = groupMetadata.participants;

    // ambil informasi pesan
    const mediaType = isQuoted ? `${isQuoted.type}Message` : `${type}Message`;

    // kirim dengan media
    if (mediaType == "imageMessage") {
      const media = isQuoted
        ? await downloadQuotedMedia(message)
        : await downloadMedia(message);
      const mediaPath = path.join("tmp", media);

      if (!fs.existsSync(mediaPath)) {
        throw new Error("File media tidak ditemukan setelah diunduh.");
      }
      const buffer = fs.readFileSync(mediaPath);
      await sock.sendMessage(idgc, {
        image: buffer,
        caption: pesangc,
        mentions: participants.map((p) => p.id),
      });
      return;
    } else {
      await sock.sendMessage(idgc, {
        text: pesangc,
        mentions: participants.map((p) => p.id),
      });
    }
  } catch (error) {
    console.error("Terjadi kesalahan:", error);
    await sock.sendMessage(
      remoteJid,
      { text: `⚠️ Terjadi kesalahan saat memproses perintah.` },
      { quoted: message }
    );
  }
}

function sendErrorMessage(sock, remoteJid, message, prefix, command) {
  return sock.sendMessage(
    remoteJid,
    {
      text: `Masukkan ID Group dengan format yang benar.

Contoh:
${prefix + command} 1234567889@g.us | Pesan yang ingin dikirim`,
    },
    { quoted: message }
  );
}
export default {
  handle,
  Commands: ["gctag"],
  OnlyPremium: false,
  OnlyOwner: true,
};
