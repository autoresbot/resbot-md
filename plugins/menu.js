// handle/menu.js

import menuProxy, { loadMenuOnce } from '../database/menu.js';
import config from '../config.js';

import { readFileAsBuffer } from '../lib/fileHelper.js';

import { reply, style, getCurrentDate, readMore } from '../lib/utils.js';

import { isOwner, isPremiumUser } from '../lib/users.js';

import fs from 'fs/promises';
import path from 'path';

import { generateWAMessageFromContent, prepareWAMessageMedia, proto } from 'baileys';

/* =========================
   CONFIG
========================= */

const GROUP_LINK = 'https://www.whatsapp.com/channel/0029VaDSRuf05MUekJbazP1D';

const ENABLE_MENU_AUDIO = true;

const MENU_MEDIA_FILE = '@assets/allmenu.jpg';

const AUDIO_PATH = path.join(process.cwd(), 'database', 'audio');

const AUDIO_FILES = {
  pagi: 'pagi.opus',
  siang: 'siang.opus',
  sore: 'sore.opus',
  petang: 'petang.opus',
  malam: 'malam.opus',
};

/* =========================
   USER ROLE
========================= */

function getUserRole(sender) {
  if (isOwner(sender)) {
    return 'Owner';
  }

  if (isPremiumUser(sender)) {
    return 'Premium';
  }

  return 'User';
}

/* =========================
   GREETING AUDIO
========================= */

function getGreetingFile() {
  const now = new Date();

  const wibHours = (now.getUTCHours() + 7) % 24;

  if (wibHours >= 5 && wibHours <= 10) {
    return AUDIO_FILES.pagi;
  }

  if (wibHours >= 11 && wibHours < 15) {
    return AUDIO_FILES.siang;
  }

  if (wibHours >= 15 && wibHours <= 18) {
    return AUDIO_FILES.sore;
  }

  if (wibHours > 18 && wibHours <= 19) {
    return AUDIO_FILES.petang;
  }

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

/* =========================
   MENU FORMAT
========================= */

function formatMenu(title, items) {
  const formattedItems = items.map((item) => {
    if (typeof item === 'string') {
      return `┣⌬ ${item}`;
    }

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

/* =========================
   SEND AUDIO
========================= */

async function sendMenuAudio(sock, jid, quoted) {
  if (!ENABLE_MENU_AUDIO) {
    return;
  }

  const audio = await getGreetingAudio();

  if (!audio) {
    return;
  }

  await sock.sendMessage(
    jid,
    {
      audio,
      mimetype: 'audio/mp4',
      ptt: true,
    },
    {
      quoted,
    },
  );
}

/* =========================
   SEND INTERACTIVE MENU
========================= */

async function sendInteractiveMenu(sock, jid, quoted, pushName, text, imageBuffer) {
  try {
    // upload image
    const media = await prepareWAMessageMedia(
      {
        image: imageBuffer,
      },
      {
        upload: sock.waUploadToServer,
      },
    );

    // create message
    const msg = generateWAMessageFromContent(
      jid,
      {
        viewOnceMessage: {
          message: {
            interactiveMessage: proto.Message.InteractiveMessage.create({
              body: proto.Message.InteractiveMessage.Body.create({
                text,
              }),

              footer: proto.Message.InteractiveMessage.Footer.create({
                text: `Resbot ${global.version}`,
              }),

              header: proto.Message.InteractiveMessage.Header.create({
                title: `Halo ${pushName}`,
                hasMediaAttachment: true,
                imageMessage: media.imageMessage,
              }),

              nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                buttons: [
                  {
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                      display_text: 'Join Channel',
                      url: GROUP_LINK,
                    }),
                  },
                ],
              }),
            }),
          },
        },
      },
      {
        quoted,
      },
    );

    // relay
    await sock.relayMessage(jid, msg.message, {
      messageId: msg.key.id,
    });

    return msg;
  } catch (err) {
    console.error('Interactive Menu Error:', err);

    // fallback normal image
    return await sock.sendMessage(
      jid,
      {
        image: imageBuffer,
        caption: text,
      },
      {
        quoted,
      },
    );
  }
}

/* =========================
   MAIN HANDLER
========================= */

async function handle(sock, messageInfo) {
  const { m, remoteJid, pushName, sender, senderLid, content, command, message } = messageInfo;

  const roleUser = getUserRole(senderLid);

  const date = getCurrentDate();

  const category = (content || '').toLowerCase();

  const menuData = await loadMenuOnce();

  let result;

  /* =========================
     CATEGORY MENU
  ========================= */

  if (category && menuData[category]) {
    const response = formatMenu(category, menuData[category]);

    result = await reply(m, style(response));
  } else if (command === 'menu') {
    /* =========================
     MENU UTAMA
  ========================= */
    const response = buildMainMenu(menuData);

    result = await reply(m, style(response));
  } else if (command === 'allmenu') {
    const response = buildAllMenu(pushName, roleUser, date, menuData);

    const buffer = await readFileAsBuffer(MENU_MEDIA_FILE);

    const caption = `
${style(response)}

──────────────────
📢 SALURAN:
${GROUP_LINK}
`;

    const msg = {
      caption,
    };

    const lowerFile = MENU_MEDIA_FILE.toLowerCase();

    if (lowerFile.endsWith('.mp4')) {
      msg.video = buffer;
    } else if (lowerFile.endsWith('.gif')) {
      msg.video = buffer;
      msg.gifPlayback = true;
    } else {
      msg.image = buffer;
    }

    result = await sock.sendMessage(remoteJid, msg, {
      quoted: message,
    });
  }

  /* =========================
     SEND AUDIO
  ========================= */

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
