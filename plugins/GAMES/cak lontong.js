import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;
import config from "../../config.js";

import { logWithTime } from "../../lib/utils.js";
import mess from "../../strings.js";

import {
  addUser,
  removeUser,
  getUser,
  isUserPlaying,
} from "../../database/temporary_db/cak lontong.js";

const WAKTU_GAMES = 60; // 60 detik

const api = new ApiAutoresbot(config.APIKEY);

/**
 * Mengirim pesan ke pengguna.
 * @param {Object} sock - Instance koneksi.
 * @param {string} remoteJid - ID pengguna.
 * @param {Object} content - Konten pesan.
 * @param {Object} options - Opsi tambahan untuk pengiriman pesan.
 */
const sendMessage = async (sock, remoteJid, content, options = {}) => {
  try {
    await sock.sendMessage(remoteJid, content, options);
  } catch (error) {
    console.error(`Gagal mengirim pesan ke ${remoteJid}:`, error);
  }
};

/**
 * Menangani game Cak Lontong.
 * @param {Object} sock - Instance koneksi.
 * @param {Object} messageInfo - Informasi pesan.
 */
const handle = async (sock, messageInfo) => {
  const { remoteJid, message, fullText } = messageInfo;

  if (!fullText.includes("lontong")) {
    return true;
  }

  // Cek apakah pengguna sudah bermain
  if (isUserPlaying(remoteJid)) {
    await sendMessage(
      sock,
      remoteJid,
      { text: mess.game.isPlaying },
      { quoted: message }
    );
    return;
  }

  try {
    const response = await api.get("/api/game/caklontong");
    const { soal, jawaban, deskripsi } = response.data;

    // Timer 60 detik untuk menjawab
    const timer = setTimeout(async () => {
      if (isUserPlaying(remoteJid)) {
        removeUser(remoteJid);
        await sendMessage(
          sock,
          remoteJid,
          {
            text: `Waktu Habis\nJawaban: ${jawaban}\nDeskripsi: ${deskripsi}\n\nIngin bermain? Ketik .cak lontong`,
          },
          { quoted: message }
        );
      }
    }, WAKTU_GAMES * 1000);

    // Tambahkan pengguna ke database
    addUser(remoteJid, {
      answer: jawaban.toLowerCase(),
      hadiah: 10, // Jumlah hadiah jika menang
      deskripsi,
      command: fullText,
      timer: timer,
    });

    // Kirim pertanyaan ke pengguna
    await sendMessage(
      sock,
      remoteJid,
      { text: `*Jawablah Pertanyaan Berikut :*\n${soal}\n*Waktu : 60s*` },
      { quoted: message }
    );

    logWithTime("Caklontong", `Jawaban : ${jawaban}`);
  } catch (error) {
    const errorMessage = `Maaf, terjadi kesalahan saat memproses permintaan Anda. Mohon coba lagi nanti.\n\n${
      error || "Kesalahan tidak diketahui"
    }`;
    await sendMessage(
      sock,
      remoteJid,
      { text: errorMessage },
      { quoted: message }
    );
  }
};

export default {
  handle,
  Commands: ["cak", "caklontong"],
  OnlyPremium: false,
  OnlyOwner: false,
};
