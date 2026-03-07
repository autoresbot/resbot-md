// handle/menu.js
import menuProxy, { loadMenuOnce } from '../database/menu.js';
import config from '../config.js';
import { readFileAsBuffer } from '../lib/fileHelper.js';
import { reply, style, getCurrentDate, readMore } from '../lib/utils.js';
import { isOwner, isPremiumUser } from '../lib/users.js';
import fs from 'fs/promises';
import path from 'path';

/* =========================
   CONFIG (MUDAH DIGANTI)
========================= */

const GROUP_LINK = 'https://www.whatsapp.com/channel/0029VaDSRuf05MUekJbazP1D';
const ENABLE_MENU_AUDIO = true;

const MENU_MEDIA_TYPE = 'image'; // image / video / gif

const MENU_MEDIA_FILE = '@assets/allmenu.jpg'; // bisa .jpg / .mp4 / .gif

const AUDIO_PATH = path.join(process.cwd(), 'database', 'audio');

const AUDIO_FILES = {
  pagi: 'pagi.opus',
  siang: 'siang.opus',
  sore: 'sore.opus',
  petang: 'petang.opus',
  malam: 'malam.opus',
};

/* =========================
   HELPER
========================= */

function getUserRole(sender) {
  if (isOwner(sender)) return 'Owner';
  if (isPremiumUser(sender)) return 'Premium';
  return 'User';
}

function getGreetingFile() {
  const now = new Date();
  const wibHours = (now.getUTCHours() + 7) % 24;

  if (wibHours >= 5 && wibHours <= 10) return AUDIO_FILES.pagi;
  if (wibHours >= 11 && wibHours < 15) return AUDIO_FILES.siang;
  if (wibHours >= 15 && wibHours <= 18) return AUDIO_FILES.sore;
  if (wibHours > 18 && wibHours <= 19) return AUDIO_FILES.petang;

  return AUDIO_FILES.malam;
}

async function getGreetingAudio() {
  try {
    const file = getGreetingFile();
    return await fs.readFile(path.join(AUDIO_PATH, file));
  } catch (err) {
    console.error('Error reading audio:', err);
    return null;
  }
}

function formatMenu(title, items) {
  const formattedItems = items.map((item) => {
    if (typeof item === 'string') return `┣⌬ ${item}`;

    if (typeof item === 'object' && item.command && item.description) {
      return `┣⌬ ${item.command} ${item.description}`;
    }

    return '┣⌬ [Invalid item]';
  });

  return `┏━『 *${title.toUpperCase()}* 』
┃
${formattedItems.join('\n')}
┗━━━━━━━◧`;
}

function buildMainMenu(menuData) {
  return `
┏━『 *MENU UTAMA* 』
┃
${Object.keys(menuData)
  .map((key) => `┣⌬ ${key}`)
  .join('\n')}
┗━━━━━━━◧
            
_Ketik nama kategori untuk melihat isinya._
_Contoh: *.menu ai* atau *.allmenu* untuk menampilkan semua menu_`;
}

function buildAllMenu(pushName, roleUser, date, menuData) {
  return `
╭─────────────
│ ᴺᵃᵐᵉ  : *${pushName || 'Unknown'}*
│ ˢᵗᵃᵗᵘˢ : *${roleUser}*
│ ᴰᵃᵗᵉ   : *${date}*
├────
╰──────────────

${readMore()}

${Object.keys(menuData)
  .map((key) => formatMenu(key, menuData[key]))
  .join('\n\n')}`;
}

async function sendMenuAudio(sock, jid, quoted) {
  if (!ENABLE_MENU_AUDIO) return;

  const audio = await getGreetingAudio();
  if (!audio) return;

  await sock.sendMessage(
    jid,
    {
      audio,
      mimetype: 'audio/mp4',
      ptt: true,
    },
    { quoted },
  );
}

/* =========================
   MAIN HANDLER
========================= */

async function handle(sock, messageInfo) {
  const { m, remoteJid, pushName, sender, content, command, message } = messageInfo;

  const roleUser = getUserRole(sender);
  const date = getCurrentDate();
  const category = (content || '').toLowerCase();

  const menuData = await loadMenuOnce();

  let result;

  /* ========= CATEGORY MENU ========= */

  if (category && menuData[category]) {
    const response = formatMenu(category, menuData[category]);

    result = await reply(m, style(response));
  } else if (command === 'menu') {
    /* ========= MENU UTAMA ========= */
    const response = buildMainMenu(menuData);

    result = await reply(m, style(response));
  } else if (command === 'allmenu') {
    /* ========= ALL MENU ========= */
    const response = buildAllMenu(pushName, roleUser, date, menuData);

    const buffer = await readFileAsBuffer(MENU_MEDIA_FILE);

    let mediaMessage = {
      text: style(response),
      contextInfo: {
        externalAdReply: {
          showAdAttribution: false,
          title: `Halo ${pushName}`,
          body: `Resbot ${global.version}`,
          thumbnail: buffer,
          jpegThumbnail: buffer,
          thumbnailUrl: GROUP_LINK,
          sourceUrl: GROUP_LINK,
          mediaType: 1,
          renderLargerThumbnail: true,
        },
      },
    };

    if (MENU_MEDIA_TYPE === 'gif') {
      mediaMessage = {
        caption: style(response),
        contextInfo: {
          externalAdReply: {
            showAdAttribution: false,
            title: `Halo ${pushName}`,
            body: `Resbot ${global.version}`,
            thumbnail: buffer,
            jpegThumbnail: buffer,
            //thumbnailUrl: GROUP_LINK,
            //sourceUrl: GROUP_LINK,
            mediaType: 1,
            //renderLargerThumbnail: true,
          },
        },
      };
    }

    if (MENU_MEDIA_TYPE === 'video') {
      mediaMessage = {
        caption: style(response),
        contextInfo: {
          externalAdReply: {
            showAdAttribution: false,
            title: `Halo ${pushName}`,
            body: `Resbot ${global.version}`,
            thumbnail: buffer,
            jpegThumbnail: buffer,
            //thumbnailUrl: GROUP_LINK,
            //sourceUrl: GROUP_LINK,
            mediaType: 1,
            //renderLargerThumbnail: true,
          },
        },
      };
    }

    /* ====== SESUAIKAN MEDIA ====== */

    switch (MENU_MEDIA_TYPE) {
      case 'image':
        mediaMessage.image = buffer;
        break;

      case 'video':
        mediaMessage.video = buffer;
        break;

      case 'gif':
        mediaMessage.video = buffer;
        mediaMessage.gifPlayback = true;
        break;

      default:
        mediaMessage.image = buffer;
    }

    /* ====== KIRIM ====== */

    result = await sock.sendMessage(remoteJid, mediaMessage, { quoted: message });
  }

  /* ========= AUDIO MENU ========= */

  if (command === 'allmenu' || (command === 'menu' && !category)) {
    await sendMenuAudio(sock, remoteJid, result);
  }
}

/* =========================
   EXPORT
========================= */

export default {
  Commands: ['menu', 'allmenu'],
  OnlyPremium: false,
  OnlyOwner: false,
  handle,
};
