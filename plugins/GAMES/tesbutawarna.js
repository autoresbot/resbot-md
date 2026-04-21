import ApiAutoresbotModule from 'api-autoresbot';
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from '../../config.js';
const api = new ApiAutoresbot(config.APIKEY);

import mess from '../../strings.js';
import { logWithTime } from '../../lib/utils.js';
import { addUser, removeUser, isUserPlaying } from '../../database/temporary_db/tesbutawarna.js';

const WAKTU_GAMES = 60;

function randomNumber(min = 1, max = 99) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomAAtoZZ() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const a = chars[Math.floor(Math.random() * 26)];
  const b = chars[Math.floor(Math.random() * 26)];
  return a + b;
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, fullText, content } = messageInfo;

  try {
    const allowed = ['easy', 'medium', 'hard'];

    // wajib isi level
    if (!content) {
      return sock.sendMessage(
        remoteJid,
        {
          text: `Silakan pilih level:\nGunakan: easy, medium, hard\n\nContoh:\n.tesbutawarna medium`,
        },
        { quoted: message },
      );
    }

    const level = content.toLowerCase();

    if (!allowed.includes(level)) {
      return sock.sendMessage(
        remoteJid,
        {
          text: `Level tidak valid.\nGunakan: easy, medium, hard\n\nContoh:\n.tesbutawarna medium`,
        },
        { quoted: message },
      );
    }

    if (isUserPlaying(remoteJid)) {
      return sock.sendMessage(remoteJid, { text: 'Kamu masih dalam game!' }, { quoted: message });
    }

    let answer;

    if (level === 'easy') {
      answer = randomNumber(1, 10).toString();
    } else if (level === 'medium') {
      answer = randomNumber(1, 100).toString();
    } else if (level === 'hard') {
      if (Math.random() < 0.5) {
        answer = randomNumber(1, 100).toString();
      } else {
        answer = randomAAtoZZ();
      }
    }

    const imageBuffer = await api.getBuffer('/api/maker/ishihara', {
      text: answer,
      level,
    });

    const timer = setTimeout(async () => {
      if (!isUserPlaying(remoteJid)) return;

      removeUser(remoteJid);

      if (mess.game_handler.waktu_habis) {
        const msg = mess.game_handler.waktu_habis.replace('@answer', answer);
        await sock.sendMessage(remoteJid, { text: msg }, { quoted: message });
      }
    }, WAKTU_GAMES * 1000);

    addUser(remoteJid, {
      answer: answer.toLowerCase(),
      hadiah: 10,
      command: fullText,
      timer,
    });

    await sock.sendMessage(
      remoteJid,
      {
        image: imageBuffer,
        caption: `Silahkan Jawab Soal Di Atas Ini

Level: ${level}
Range:
- easy: 1–10
- medium: 1–100
- hard: 1–100 & AA–ZZ

Waktu: ${WAKTU_GAMES}s`,
      },
      { quoted: message },
    );

    logWithTime('Tes Buta Warna', `Jawaban: ${answer} | Level: ${level}`);
  } catch (error) {
    await sock.sendMessage(
      remoteJid,
      { text: `Maaf, terjadi kesalahan.\n\n${error.message || error}` },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['tesbutawarna'],
  OnlyPremium: false,
  OnlyOwner: false,
};
