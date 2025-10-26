import { getDataByGroupId } from "../lib/list.js";
import fs from "fs/promises";
import config from "../config.js";
import chalk from "chalk";
import { logTracking } from "../lib/utils.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const lastMessageTime = {};

async function process(sock, messageInfo) {
  const { remoteJid, message, fullText } = messageInfo;

  try {
    const keyword = fullText.trim(); // Menghapus spasi di awal/akhir
    if (!keyword) return;
    let currentList = await getDataByGroupId("owner");
    if (!currentList) return;

    const searchResult = Object.keys(currentList.list).filter(
      (item) => item.toLowerCase().trim() === keyword.toLowerCase().trim()
    );

    if (searchResult.length === 0) return;
    const { text, media } = currentList.list[searchResult[0]].content;

    // RATE LIMIT
    const now = Date.now();
    if (lastMessageTime[remoteJid]) {
      if (now - lastMessageTime[remoteJid] < config.rate_limit) {
        console.log(chalk.redBright(`Rate limit respon : ${keyword}`));
        return false;
      }
    }
    lastMessageTime[remoteJid] = now;

    if (media) {
      const buffer = await getMediaBuffer(media);
      if (buffer) {
        // ambil ekstensi file (tanpa titik)
        const ext = media.split(".").pop().toLowerCase();
        let typeMedia = "";

        if (ext === "webp") {
          typeMedia = "sticker";
        } else if (ext === "mp3") {
          typeMedia = "audio";
        } else if (["jpg", "jpeg", "png"].includes(ext)) {
          typeMedia = "image";
        } else if (["mp4", "mkv", "mov"].includes(ext)) {
          typeMedia = "video";
        } else {
          typeMedia = "unknown";
        }

        //console.log(`Detected typeMedia: ${typeMedia}`);

        await sendMediaMessage(
          sock,
          remoteJid,
          buffer,
          text,
          message,
          typeMedia
        );
      } else {
        console.error(`Media not found or failed to read: ${media}`);
      }
    } else {
      await sendTextMessage(sock, remoteJid, text, message);
    }

    logTracking(`Respon Handler - ${remoteJid}`);
    return false;
  } catch (error) {
    console.error("Error processing message:", error);
  }
}

async function getMediaBuffer(mediaFileName) {
  const filePath = path.join(__dirname, "../database/media", mediaFileName);
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    console.error(`Failed to read media file: ${filePath}`, error);
    return null;
  }
}

async function sendMediaMessage(
  sock,
  remoteJid,
  buffer,
  caption,
  quoted,
  typeMedia
) {
  // typeMedia: sticker, audio, image, video
  try {
    if (typeMedia === "image") {
      await sock.sendMessage(remoteJid, { image: buffer, caption }, { quoted });
    } else if (typeMedia === "video") {
      await sock.sendMessage(remoteJid, { video: buffer, caption }, { quoted });
    } else if (typeMedia === "audio") {
      await sock.sendMessage(
        remoteJid,
        {
          audio: buffer,
          fileName: "addrespon.mp3",
          mimetype: "audio/mp4", // opsional, bisa pakai 'audio/mpeg' juga
        },
        { quoted }
      );
    } else if (typeMedia === "sticker") {
      await sock.sendMessage(
        remoteJid,
        {
          sticker: buffer,
        },
        { quoted }
      );
    } else {
      console.warn(`Unknown typeMedia: ${typeMedia}`);
    }
  } catch (error) {
    console.error("Failed to send media message:", error);
  }
}

async function sendTextMessage(sock, remoteJid, text, quoted) {
  try {
    await sock.sendMessage(remoteJid, { text }, { quoted });
  } catch (error) {
    console.error("Failed to send text message:", error);
  }
}

export default {
  name: "List Response",
  priority: 9,
  process,
};
