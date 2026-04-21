import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";
import mess from "../../strings.js";
import { logWithTime } from "../../lib/utils.js";
import {
  addUser,
  isUserPlaying,
} from "../../database/temporary_db/family100.js";

const api = new ApiAutoresbot(config.APIKEY);

async function handle(sock, messageInfo) {
  const { remoteJid, message } = messageInfo;

  try {
    // Periksa apakah pengguna sudah bermain
    if (isUserPlaying(remoteJid)) {
      await sock.sendMessage(
        remoteJid,
        { text: mess.game.isPlaying },
        { quoted: message }
      );
      return;
    }

    // Ambil data permainan dari API
    const response = await api.get(`/api/game/family100`);
    const gameData = response?.data;

    if (!gameData) {
      throw new Error("Failed to fetch game data");
    }

    const { soal, jawaban } = gameData;
    console.log(jawaban);

    logWithTime("Family100", `Jawaban : ${jawaban}`);

    // Tambahkan pengguna ke database permainan
    addUser(remoteJid, {
      soal,
      answer: jawaban,
      terjawab: Array(jawaban.length).fill(false), // Array untuk jawaban yang sudah ditebak
      hadiahPerJawabanBenar: 1, // Hadiah untuk setiap jawaban yang benar
      hadiahJikaMenang: 20, // Hadiah jika semua jawaban berhasil ditebak (menang)
    });

    // Format pesan untuk pertanyaan
    const hasSpacedAnswer = jawaban.some((answer) => answer.includes(" "));
    const messageText = `*Jawablah Pertanyaan Berikut:*\n${soal}\n\nTerdapat *${
      jawaban.length
    }* jawaban${hasSpacedAnswer ? " (beberapa jawaban terdapat spasi)" : ""}.`;

    // Kirim pesan ke pengguna
    await sock.sendMessage(
      remoteJid,
      { text: messageText },
      { quoted: message }
    );
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
  Commands: ["family100"],
  OnlyPremium: false,
  OnlyOwner: false,
};
