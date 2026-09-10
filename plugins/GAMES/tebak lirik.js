import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";
const api = new ApiAutoresbot(config.APIKEY);

import mess from "../../strings.js";
import { logWithTime } from "../../lib/utils.js";

const WAKTU_GAMES = 60; // 60 detik

import {
  addUser,
  removeUser,
  getUser,
  isUserPlaying,
} from "../../database/temporary_db/tebak lirik.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, fullText } = messageInfo;

  if (!fullText.includes("lirik")) {
    return true;
  }

  try {
    const response = await api.get(`/api/game/tebaklirik`);

    const soal = response.data.soal;
    const jawaban = response.data.jawaban;

    // Ketika sedang bermain
    if (isUserPlaying(remoteJid)) {
      return await sock.sendMessage(
        remoteJid,
        { text: mess.game.isPlaying },
        { quoted: message }
      );
    }

    // Buat timer baru untuk user
    const timer = setTimeout(async () => {
      if (!isUserPlaying(remoteJid)) return;

      removeUser(remoteJid); // Hapus user dari database jika waktu habis

      if (mess.game_handler.waktu_habis) {
        const messageWarning = mess.game_handler.waktu_habis.replace(
          "@answer",
          jawaban
        );
        await sock.sendMessage(
          remoteJid,
          { text: messageWarning },
          { quoted: message }
        );
      }
    }, WAKTU_GAMES * 1000);

    // Tambahkan pengguna ke database
    addUser(remoteJid, {
      answer: jawaban.toLowerCase(),
      hadiah: 10, // jumlah money jika menang
      command: fullText,
      timer: timer,
    });

    await sock.sendMessage(
      remoteJid,
      {
        text: `Silahkan Jawab Pertanyaan Berikut\n\n${soal}\nWaktu : ${WAKTU_GAMES}s`,
      },
      { quoted: message }
    );

    logWithTime("Tebak lirik", `Jawaban : ${jawaban}`);
  } catch (error) {
    const errorMessage = `Maaf, terjadi kesalahan saat memproses permintaan Anda. Mohon coba lagi nanti.\n\n${
      error || "Kesalahan tidak diketahui"
    }`;
    await sock.sendMessage(
      remoteJid,
      { text: errorMessage },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["tebak", "tebaklirik"],
  OnlyPremium: false,
  OnlyOwner: false,
};
