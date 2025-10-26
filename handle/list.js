import { getDataByGroupId } from "../lib/list.js";
import fs from "fs/promises";
import {
  getCurrentDate,
  sendMessageWithMention,
  sendImagesWithMention,
  getCurrentTime,
  getGreeting,
  getHari,
  logTracking,
} from "../lib/utils.js";
import { getGroupMetadata } from "../lib/cache.js";
import config from "../config.js";
import { sendImageAsSticker } from "../lib/exif.js";
import chalk from "chalk";

const lastMessageTime = {};

async function process(sock, messageInfo) {
  const { remoteJid, sender, isGroup, message, fullText, senderType } =
    messageInfo;

  if (!isGroup || !fullText) return true;

  try {
    const keyword = fullText.trim();
    if (!keyword) return;

    const currentList = await getDataByGroupId(remoteJid);
    if (!currentList) return;

    const searchResult = Object.keys(currentList.list).filter(
      (item) => item.toLowerCase().trim() === keyword.toLowerCase().trim()
    );

    if (searchResult.length === 0) return;

    // RATE LIMIT
    const now = Date.now();
    if (lastMessageTime[remoteJid]) {
      if (now - lastMessageTime[remoteJid] < config.rate_limit) {
        console.log(chalk.redBright(`Rate limit list : ${keyword}`));
        return false;
      }
    }
    lastMessageTime[remoteJid] = now;

    const { text, media } = currentList.list[searchResult[0]].content;

    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    if (!groupMetadata) {
      console.error("Failed to fetch group metadata");
      return;
    }

    const { subject, desc, size } = groupMetadata;
    const date = getCurrentDate();
    const time = getCurrentTime();
    const greeting = getGreeting();
    const day = getHari();
    const targetMention = `@${sender.split("@")[0]}`;

    const replacements = {
      "@name": targetMention,
      "@date": date,
      "@day": day,
      "@desc": desc,
      "@group": subject,
      "@greeting": greeting,
      "@size": size,
      "@time": time,
      "@sender": targetMention,
    };

    let customizedMessage = text;
    for (const [key, value] of Object.entries(replacements)) {
      const regex = new RegExp(key.replace(/@/, "@"), "gi");
      customizedMessage = customizedMessage.replace(regex, value);
    }

    if (media) {
      const buffer = await getMediaBuffer(media);
      if (buffer) {
        if (media.includes("webp")) {
          const options = {
            packname: config.sticker_packname,
            author: config.sticker_author,
          };
          await sendImageAsSticker(sock, remoteJid, buffer, options, message);
        } else if (media.includes("mp4")) {
          await sock.sendMessage(
            remoteJid,
            {
              video: buffer,
              mimetype: "video/mp4",
              caption: customizedMessage || "",
            },
            { quoted: message }
          );
        } else if (media.includes("audio")) {
          await sock.sendMessage(
            remoteJid,
            { audio: buffer, mimetype: "audio/mp4" },
            { quoted: message }
          );
        } else if (
          media.includes("jpg") ||
          media.includes("jpeg") ||
          media.includes("png")
        ) {
          await sendImagesWithMention(
            sock,
            remoteJid,
            buffer,
            customizedMessage,
            message,
            senderType
          );
        } else {
          await sock.sendMessage(
            remoteJid,
            { document: buffer, fileName: media, mimetype: "application/zip" },
            { quoted: message }
          );
        }
        logTracking(`List Handler - ${sender}`);

        // await sendMediaMessage(sock, remoteJid, buffer, text, message);
      } else {
        console.error(`Media not found or failed to read: ${media}`);
      }
      return false;
    } else {
      await sendMessageWithMention(
        sock,
        remoteJid,
        customizedMessage,
        message,
        senderType
      );
      return false;
    }
    return false;
  } catch (error) {
    console.error("Error processing message:", error);
  }
}

async function getMediaBuffer(mediaFileName) {
  const filePath = `./database/media/${mediaFileName}`;
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    console.error(`Failed to read media file: ${filePath}`, error);
    return null;
  }
}

export default {
  name: "List Handle",
  priority: 1,
  process,
};
