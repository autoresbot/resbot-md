import { getGroupMetadata } from "../../lib/cache.js";
import { downloadQuotedMedia, downloadMedia } from "../../lib/utils.js";

import fs from "fs";

async function delay(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration * 1000));
}

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

  const jedaDetik = 5; // Waktu jeda dalam detik

  try {
    // Validasi input kosong atau tidak sesuai format
    if (!content || !content.trim()) {
      return sendErrorMessage(sock, remoteJid, message, prefix, command);
    }

    const [idgc, text] = content.split("|").map((item) => item.trim());

    // Validasi format grup dan teks
    if (!idgc || !text || !idgc.includes("@g.us")) {
      return sendErrorMessage(sock, remoteJid, message, prefix, command);
    }

    // Tampilkan reaksi sementara untuk memproses
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Ambil metadata grup
    const metadata = await getGroupMetadata(sock, idgc);
    if (!metadata) {
      return await sock.sendMessage(
        remoteJid,
        { text: "Grup tidak ditemukan." },
        { quoted: message }
      );
    }

    // Ambil id atau phoneNumber dari peserta grup
    const allUsers = metadata.participants
      .map((v) => v.phoneNumber || v.id)
      .filter(Boolean); // buang yang undefined atau null

    if (allUsers.length === 0) {
      return await sock.sendMessage(
        remoteJid,
        { text: "⚠️ _Tidak ada kontak yang sesuai filter._" },
        { quoted: message }
      );
    }

    // Unduh media jika diperlukan
    let buffer = null;
    const mediaType = isQuoted ? `${isQuoted.type}Message` : `${type}Message`;
    if (mediaType === "imageMessage") {
      const mediaPath = isQuoted
        ? await downloadQuotedMedia(message)
        : await downloadMedia(message);

      if (mediaPath && fs.existsSync(mediaPath)) {
        buffer = fs.readFileSync(mediaPath);
      } else {
        throw new Error("File media tidak ditemukan setelah diunduh.");
      }
    }

    const messageContent = buffer ? { image: buffer, caption: text } : { text };

    // Kirim pesan ke semua grup dengan jeda
    for (const user of allUsers) {
      await sock.sendMessage(user, messageContent);
      console.log(`Pesan terkirim ke ${user}`);
      await delay(jedaDetik);
    }

    // Kirim konfirmasi sukses
    await sock.sendMessage(
      remoteJid,
      { text: `✅ _Pesan berhasil dikirim ke ${allUsers.length} orang_` },
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

function sendErrorMessage(sock, remoteJid, message, prefix, command) {
  return sock.sendMessage(
    remoteJid,
    {
      text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
        prefix + command
      } 123xxx@g.us | Teks yang ingin dikirim*_`,
    },
    { quoted: message }
  );
}

export default {
  handle,
  Commands: ["pushkontak"],
  OnlyPremium: false,
  OnlyOwner: true,
};
