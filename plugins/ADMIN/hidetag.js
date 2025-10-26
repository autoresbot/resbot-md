import mess from "../../strings.js";
import { downloadQuotedMedia, downloadMedia } from "../../lib/utils.js";
import fs from "fs/promises";
import { getGroupMetadata } from "../../lib/cache.js";
import { sendImageAsSticker } from "../../lib/exif.js";
import { isOwner } from "../../lib/users.js";
import config from "../../config.js";

function getMediaContent(media) {
  if (media.type === "video" || media.type === "image") {
    return media.content.caption;
  }
  return media.content || media.text;
}

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender, content, isQuoted, type } =
    messageInfo;
  if (!isGroup) return; // Only Grub

  try {
    // Mendapatkan metadata grup
    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    const participants = groupMetadata.participants;
    const isAdmin = participants.some(
      (p) => (p.phoneNumber === sender || p.id === sender) && p.admin
    );

    const isOwnerUsers = isOwner(sender);

    if (!isAdmin && !isOwnerUsers) {
      await sock.sendMessage(
        remoteJid,
        { text: mess.general.isAdmin },
        { quoted: message }
      );
      return;
    }

    // Unduh media
    const media = isQuoted
      ? await downloadQuotedMedia(message)
      : await downloadMedia(message);

    const mediaType = isQuoted ? `${isQuoted.type}Message` : `${type}Message`;
    let mediaContent = "";

    if (isQuoted) {
      mediaContent = getMediaContent(isQuoted);
    }

    if (content && content.trim() !== "") {
      mediaContent = content.trim();
    }

    // Kirim media atau pesan teks
    if (media) {
      const mediaPath = `tmp/${media}`;
      await checkFileExists(mediaPath); // Validasi file
      await sendMedia(
        sock,
        remoteJid,
        mediaType,
        mediaPath,
        mediaContent,
        message,
        participants
      );
    } else {
      await sendTextMessage(
        sock,
        remoteJid,
        mediaContent,
        message,
        participants
      );
    }
  } catch (error) {
    console.error("Error:", error.message);
    await sendTextMessage(
      sock,
      remoteJid,
      "⚠️ Terjadi kesalahan: " + error.message,
      message,
      participants
    );
  }
}

// Fungsi untuk validasi keberadaan file
async function checkFileExists(path) {
  try {
    await fs.access(path);
  } catch {
    throw new Error(`File media tidak ditemukan: ${path}`);
  }
}

// Fungsi untuk mengirim pesan teks
async function sendTextMessage(sock, remoteJid, text, quoted, participants) {
  text = typeof text === "string" ? text : "";
  await sock.sendMessage(
    remoteJid,
    { text: text, mentions: participants.map((p) => p.id) },
    { quoted }
  );
}

// Fungsi untuk mengirim media
async function sendMedia(
  sock,
  remoteJid,
  type,
  mediaPath,
  caption,
  message,
  participants
) {
  const mediaOptions = {
    audioMessage: { audio: await fs.readFile(mediaPath) },
    imageMessage: {
      image: await fs.readFile(mediaPath),
      caption,
      mentions: participants.map((p) => p.id),
    },
    videoMessage: {
      video: await fs.readFile(mediaPath),
      caption,
      mentions: participants.map((p) => p.id),
    },
    documentMessage: {
      document: await fs.readFile(mediaPath),
      caption,
      mentions: participants.map((p) => p.id),
    },
    stickerMessage: {
      stickerMessage: await fs.readFile(mediaPath),
      caption,
      mentions: participants.map((p) => p.id),
    },
  };

  const options = mediaOptions[type];
  if (!options) {
    throw new Error(`Tipe media tidak didukung: ${type}`);
  }

  if (type == "stickerMessage") {
    const options2 = {
      packname: config.sticker_packname,
      author: config.sticker_author,
      mentions: options.mentions,
    };
    const buffer = options.stickerMessage;
    // Kirim stiker
    await sendImageAsSticker(sock, remoteJid, buffer, options2, message);
    return;
  }
  await sock.sendMessage(remoteJid, options, { quoted: message });
}

export default {
  handle,
  Commands: ["hidetag", "h", "hidetak"],
  OnlyPremium: false,
  OnlyOwner: false,
};
