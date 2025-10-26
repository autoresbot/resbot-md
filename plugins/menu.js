// handle/menu.js
import menuProxy, { loadMenuOnce } from "../database/menu.js";
import config from "../config.js";
import { readFileAsBuffer } from "../lib/fileHelper.js";
import { reply, style, getCurrentDate, readMore } from "../lib/utils.js";
import { isOwner, isPremiumUser } from "../lib/users.js";
import fs from "fs/promises";
import path from "path";

// konstanta
const linkGroup = "https://www.whatsapp.com/channel/0029VaDSRuf05MUekJbazP1D";
const AUDIO_MENU = true;
const soundPagi = "pagi.opus";
const soundSiang = "siang.opus";
const soundSore = "sore.opus";
const soundPetang = "petang.opus";
const soundMalam = "malam.opus"; // ./database/audio

async function getGreeting() {
  const now = new Date();
  const wibHours = (now.getUTCHours() + 7) % 24;

  let fileName;
  if (wibHours >= 5 && wibHours <= 10) fileName = soundPagi;
  else if (wibHours >= 11 && wibHours < 15) fileName = soundSiang;
  else if (wibHours >= 15 && wibHours <= 18) fileName = soundSore;
  else if (wibHours > 18 && wibHours <= 19) fileName = soundPetang;
  else fileName = soundMalam;

  try {
    return await fs.readFile(
      path.join(process.cwd(), "database", "audio", fileName)
    );
  } catch (err) {
    console.error("Error reading audio file:", err);
    return null;
  }
}

const formatMenu = (title, items) => {
  const formattedItems = items.map((item) => {
    if (typeof item === "string") return `┣⌬ ${item}`;
    if (typeof item === "object" && item.command && item.description)
      return `┣⌬ ${item.command} ${item.description}`;
    return "┣⌬ [Invalid item]";
  });

  return `┏━『 *${title.toUpperCase()}* 』\n┃\n${formattedItems.join(
    "\n"
  )}\n┗━━━━━━━◧`;
};

async function handle(sock, messageInfo) {
  const { m, remoteJid, pushName, sender, content, command, message } =
    messageInfo;

  const roleUser = isOwner(sender)
    ? "Owner"
    : isPremiumUser(sender)
    ? "Premium"
    : "user";

  const date = getCurrentDate();
  const category = (content || "").toLowerCase();

  // --- pastikan menu sudah ter-load ---
  const menuData = await loadMenuOnce();

  let response;
  let result;

  if (category && menuData[category]) {
    response = formatMenu(category.toUpperCase(), menuData[category]);
    result = await reply(m, style(response) || "Failed to apply style.");
  } else if (command === "menu") {
    response = `
┏━『 *MENU UTAMA* 』
┃
${Object.keys(menuData)
  .map((key) => `┣⌬ ${key}`)
  .join("\n")}
┗━━━━━━━◧
            
_Ketik nama kategori untuk melihat isinya._\n_Contoh: *.menu ai* atau *.allmenu* untuk menampilkan semua menu_`;
    result = await reply(m, style(response) || "Failed to apply style.");
  } else if (command === "allmenu") {
    response = `
╭─────────────
│ ᴺᵃᵐᵉ  : *${pushName || "Unknown"}*
│ ˢᵗᵃᵗᵘˢ : *${roleUser}*
│ ᴰᵃᵗᵉ   : *${date}*
├────
╰──────────────

${readMore()}

${Object.keys(menuData)
  .map((key) => formatMenu(key.toUpperCase(), menuData[key]))
  .join("\n\n")}`;

    const buffer = await readFileAsBuffer("@assets/allmenu.jpg");

    result = await sock.sendMessage(
      remoteJid,
      {
        text: style(response),
        contextInfo: {
          externalAdReply: {
            showAdAttribution: false,
            title: `Halo ${pushName}`,
            body: `Resbot ${global.version}`,
            thumbnail: buffer,
            jpegThumbnail: buffer,
            thumbnailUrl: linkGroup,
            sourceUrl: linkGroup,
            mediaType: 1,
            renderLargerThumbnail: true,
          },
        },
      },
      { quoted: message }
    );
  }

  // Kirim audio jika allmenu atau menu tanpa kategori
  if (command === "allmenu" || (command === "menu" && !category)) {
    if (AUDIO_MENU) {
      const audioBuffer = await getGreeting();
      if (audioBuffer) {
        await sock.sendMessage(
          remoteJid,
          { audio: audioBuffer, mimetype: "audio/mp4", ptt: true, },
          { quoted: result }
        );
      }
    }
  }
}

export default {
  Commands: ["menu", "allmenu"],
  OnlyPremium: false,
  OnlyOwner: false,
  handle,
};
