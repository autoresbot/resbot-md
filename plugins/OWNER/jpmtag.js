import { groupFetchAllParticipating } from "../../lib/cache.js";
import { downloadQuotedMedia, downloadMedia } from "../../lib/utils.js";
import fs from "fs";
import path from "path";

import axios from "axios";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const jeda = 5; // 5 detik

let isRunning = false;

function detectFirstWhatsAppGroupLink(text) {
  const regex = /https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{22}/;
  const match = text.match(regex);
  return match ? match[0] : null;
}

async function fetchGroupInfo(url) {
  try {
    const apiUrl = `https://api.autoresbot.com/api/stalker/whatsapp-group?url=${encodeURIComponent(
      url
    )}`;
    const response = await axios.get(apiUrl);
    return response.data;
  } catch (error) {
    console.error(`Gagal fetch info grup untuk ${url}`, error.message);
    return null;
  }
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

  const useMentions = true; // Ubah menjadi true jika ingin menggunakan mention

  const link = detectFirstWhatsAppGroupLink(content);

  try {
    if (isRunning) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ _Proses Jpm Sedang Berlangsung._ _Silakan tunggu hingga selesai._`,
        },
        { quoted: message }
      );
    }

    // Validasi input kosong atau tidak sesuai format
    if (!content || content.trim() === "") {
      return sendErrorMessage(sock, remoteJid, message, prefix, command);
    }

    isRunning = true;
    // Tampilkan reaksi sementara untuk memproses
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Ambil metadata grup
    const groupFetchAll = await groupFetchAllParticipating(sock);
    if (!groupFetchAll) {
      isRunning = false;
      return await sock.sendMessage(
        remoteJid,
        { text: `⚠️ Tidak ada grup ditemukan.` },
        { quoted: message }
      );
    }

    // Filter grup berdasarkan kondisi tertentu
    const groupIds = Object.values(groupFetchAll)
      .filter((group) => group.isCommunity == false) // Sesuaikan kondisi
      .map((group) => group.id);

    if (groupIds.length === 0) {
      isRunning = false;
      return await sock.sendMessage(
        remoteJid,
        { text: `⚠️ Tidak ada grup dengan kondisi yang sesuai ditemukan.` },
        { quoted: message }
      );
    }

    // Ambil informasi pesan
    const mediaType = isQuoted ? `${isQuoted.type}Message` : `${type}Message`;
    const pesangc = content; // Isi pesan untuk dikirim

    let imageLink;
    if (link) {
      const info = await fetchGroupInfo(link);
      if (info) {
        imageLink = info.imageLink;
      }
    }

    let buffer;
    if (mediaType === "imageMessage") {
      const media = isQuoted
        ? await downloadQuotedMedia(message)
        : await downloadMedia(message);

      const mediaPath = path.join("tmp", media);

      if (!fs.existsSync(mediaPath)) {
        throw new Error("File media tidak ditemukan setelah diunduh.");
      }

      buffer = fs.readFileSync(mediaPath);
    }

    // Kirim pesan ke semua grup
    for (const groupId of groupIds) {
      const participants = Object.values(
        groupFetchAll[groupId]?.participants || []
      );
      const mentions = useMentions ? participants.map((p) => p.id) : undefined;

      if (mediaType === "imageMessage") {
        await sock.sendMessage(groupId, {
          image: buffer,
          caption: pesangc,
          mentions: mentions,
        });
      } else if (imageLink) {
        await sock.sendMessage(groupId, {
          image: { url: imageLink },
          caption: pesangc,
          mentions: mentions,
        });
      } else {
        await sock.sendMessage(groupId, {
          text: pesangc,
          mentions: mentions,
        });
      }

      // Jeda 5 detik
      await sleep(jeda * 1000);
    }

    isRunning = false;

    // Kirim konfirmasi sukses
    await sock.sendMessage(
      remoteJid,
      { text: `✅ Pesan berhasil dikirim ke ${groupIds.length} grup` },
      { quoted: message }
    );
  } catch (error) {
    isRunning = false;
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
      } pengumuman bot whatsapp*_`,
    },
    { quoted: message }
  );
}

export default {
  handle,
  Commands: ["jpmtag"],
  OnlyPremium: false,
  OnlyOwner: true,
};
