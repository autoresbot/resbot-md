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
} from "../../database/temporary_db/tebak kata.js";

/** Samakan bentuk jawaban: huruf kecil, tanpa spasi berlebih. */
function rapikanJawaban(teks) {
  return String(teks || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, fullText } = messageInfo;

  // Dibandingkan dalam huruf kecil: dulu ".Tebak Kata" tidak cocok dengan
  // "kata" sehingga perintahnya lewat begitu saja TANPA pesan apa pun.
  if (!String(fullText || "").toLowerCase().includes("kata")) {
    return true;
  }

  // Dicek SEBELUM memanggil API. Dulu urutannya terbalik, jadi setiap kali
  // ada yang mengetik ulang saat permainan berjalan, satu permintaan ke
  // server tetap terpakai percuma.
  if (isUserPlaying(remoteJid)) {
    return await sock.sendMessage(
      remoteJid,
      { text: mess.game.isPlaying },
      { quoted: message }
    );
  }

  try {
    const response = await api.get(`/api/game/tebakkata`);

    const soal = response?.data?.soal;
    const jawaban =
      typeof response?.data?.jawaban === "string"
        ? response.data.jawaban.trim()
        : "";

    // Soal yang tidak lengkap dulu tetap diteruskan sampai meledak di
    // `jawaban.toLowerCase()`, dan pemain hanya melihat tulisan error.
    if (!soal || !jawaban) {
      logWithTime(
        "Tebak kata",
        `Soal tidak lengkap dari server: ${JSON.stringify(response?.data)}`
      );
      return await sock.sendMessage(
        remoteJid,
        { text: "⚠️ _Soal sedang tidak tersedia. Coba lagi sebentar lagi._" },
        { quoted: message }
      );
    }

    // Datanya disimpan DULU, timernya menyusul. Dengan urutan ini tidak
    // pernah ada timer yang berjalan tanpa data permainannya.
    addUser(remoteJid, {
      answer: rapikanJawaban(jawaban),
      hadiah: 10, // jumlah money jika menang
      command: fullText,
      timer: null,
    });

    const timer = setTimeout(async () => {
      if (!isUserPlaying(remoteJid)) return;

      removeUser(remoteJid); // Hapus user dari database jika waktu habis

      try {
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
      } catch (error) {
        // Tanpa penangkap ini kegagalan kirim (mis. sesi sedang reconnect)
        // hilang diam-diam: permainannya sudah dihapus tapi pemain tidak
        // pernah diberi tahu jawabannya.
        logWithTime(
          "Tebak kata",
          `Gagal kirim pesan waktu habis: ${error?.message || error}`
        );
      }
    }, WAKTU_GAMES * 1000);

    const data = getUser(remoteJid);
    if (data) {
      data.timer = timer;
    } else {
      clearTimeout(timer); // permainannya sudah berakhir duluan
    }

    logWithTime("Tebak kata", `Jawaban : ${jawaban}`);

    await sock.sendMessage(
      remoteJid,
      {
        text: `Silahkan Jawab Pertanyaan Berikut\n\n${soal}\nWaktu : ${WAKTU_GAMES}s`,
      },
      { quoted: message }
    );
  } catch (error) {
    // Jangan tinggalkan permainan setengah jadi di memori.
    removeUser(remoteJid);
    logWithTime(
      "Tebak kata",
      `Gagal memulai permainan: ${error?.message || error}`
    );

    await sock.sendMessage(
      remoteJid,
      { text: "⚠️ _Gagal memuat soal. Coba lagi sebentar lagi._" },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["tebak", "tebakkata"],
  OnlyPremium: false,
  OnlyOwner: false,
};
