const menu = require("@DB/menu"); // pindah ke folder database menu.js

const linkGroup = "https://www.whatsapp.com/channel/0029VaDSRuf05MUekJbazP1D";
const AUDIO_MENU = true;

const fs = require("fs");
const path = require("path");
const config = require("@config");
const { readFileAsBuffer } = require("@lib/fileHelper");
const { reply, style, getCurrentDate, readMore } = require("@lib/utils");
const { isOwner, isPremiumUser } = require("@lib/users");

const soundPagi = "pagi.m4a"; // bisa .mp3
const soundSiang = "siang.m4a";
const soundSore = "sore.m4a";
const soundPetang = "petang.m4a";
const soundMalam = "malam.m4a"; // lokasi file ada di ./database/audio

function getGreeting() {
  const now = new Date();
  const utcHours = now.getUTCHours(); // Jam UTC
  const wibHours = (utcHours + 7) % 24;
  // Tentukan file audio berdasarkan jam
  let fileName;

  if (wibHours >= 5 && wibHours <= 10) {
    fileName = soundPagi;
  } else if (wibHours >= 11 && wibHours < 15) {
    fileName = soundSiang;
  } else if (wibHours >= 15 && wibHours <= 18) {
    fileName = soundSore;
  } else if (wibHours > 18 && wibHours <= 19) {
    fileName = soundPetang;
  } else {
    fileName = soundMalam;
  }

  // Ambil lokasi file berdasarkan direktori kerja utama (process.cwd())
  const filePath = path.join(process.cwd(), "database", "audio", fileName);

  try {
    // Baca file sebagai buffer
    const audioBuffer = fs.readFileSync(filePath);
    return audioBuffer;
  } catch (err) {
    console.error("Error reading file:", err);
    return null;
  }
}

async function handle(sock, messageInfo) {
  const { m, remoteJid, pushName, sender, content, prefix, command, message } =
    messageInfo;

  const roleUser = (await isOwner(sender))
    ? "Owner"
    : (await isPremiumUser(sender))
    ? "Premium"
    : "user";

  const date = getCurrentDate();
  const category = content.toLowerCase();

  let response;
  let result;
  if (category && menu[category]) {
    // Jika kategori ditemukan
    response = formatMenu(category.toUpperCase(), menu[category]);
    result = await reply(m, style(response) || "Failed to apply style.");
  } else {
    if (command === "menu") {
      response = `
┏━『 *MENU UTAMA* 』
┃
${Object.keys(menu)
  .map((key) => `┣⌬ ${key}`)
  .join("\n")}
┗━━━━━━━◧
            
_Ketik nama kategori untuk melihat isinya._ \n\n_Contoh: *.menu ai*_ atau *.allmenu* untuk menampilkan semua menu`;
      result = await reply(m, style(response) || "Failed to apply style.");
    } else if (command === "allmenu") {
      // Menampilkan semua menu

      response = `
╭─────────────
│ ᴺᵃᵐᵉ  : *${pushName || "Unknown"}*
│ ˢᵗᵃᵗᵘˢ : *${roleUser}*
│ ᴰᵃᵗᵉ   : *${date}*
├────
╰──────────────

${readMore()}

${Object.keys(menu)
  .map((key) => formatMenu(key.toUpperCase(), menu[key]))
  .join("\n\n")}
            `;

      const buffer = readFileAsBuffer("@assets/allmenu.jpg");

      result = await sock.sendMessage(
        remoteJid,
        {
          text: style(response),
          contextInfo: {
            externalAdReply: {
              showAdAttribution: false,
              title: `Halo ${pushName}`,
              body: `Resbot ${config.version}`,
              thumbnail: buffer,
              jpegThumbnail: buffer, // tambahkan ini
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
  }

  if (command === "allmenu" || (command === "menu" && content === "")) {
    // kirim audio ketika allmenu
    if (AUDIO_MENU) {
      const audioBuffer = getGreeting();
      await sock.sendMessage(
        remoteJid,
        { audio: audioBuffer, mimetype: "audio/mp4", ptt: true },
        { quoted: result }
      );
    }
  }
}

const formatMenu = (title, items) => {
  const formattedItems = items.map((item) => {
    if (typeof item === "string") {
      return `┣⌬ ${item}`;
    }
    if (typeof item === "object" && item.command && item.description) {
      return `┣⌬ ${item.command} ${item.description}`;
    }
    return "┣⌬ [Invalid item]";
  });

  return `┏━『 *${title.toUpperCase()}* 』\n┃\n${formattedItems.join(
    "\n"
  )}\n┗━━━━━━━◧`;
};

module.exports = {
  handle,
  Commands: ["menu", "allmenu"],
  OnlyPremium: false,
  OnlyOwner: false,
};
