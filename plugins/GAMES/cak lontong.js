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
/** Samakan bentuk jawaban: huruf kecil, tanpa spasi berlebih. */
function rapikanJawaban(teks) {
  return String(teks || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const handle = async (sock, messageInfo) => {
  const { remoteJid, message, fullText } = messageInfo;

  if (!String(fullText || '').toLowerCase().includes('lontong')) {
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

    // Soal yang tidak lengkap dulu tetap diteruskan sampai meledak saat
    // jawabannya diolah, dan isi error mentahnya ikut terkirim ke grup.
    if (!rapikanJawaban(jawaban)) {
      logWithTime('Caklontong', `Soal tidak lengkap dari server: ${JSON.stringify(response?.data)}`);
      return await sendMessage(
        sock,
        remoteJid,
        { text: '⚠️ _Soal sedang tidak tersedia. Coba lagi sebentar lagi._' },
        { quoted: message }
      );
    }

    // Data permainan disimpan DULU, timernya menyusul. Dengan urutan ini
    // tidak pernah ada timer yang berjalan tanpa data permainannya.
    const dataGame = {
      answer: rapikanJawaban(jawaban),
      hadiah: 10, // Jumlah hadiah jika menang
      deskripsi,
      command: fullText,
      timer: null,
    };

    addUser(remoteJid, dataGame);

    const timer = setTimeout(async () => {
      if (!isUserPlaying(remoteJid)) return;

      removeUser(remoteJid);

      try {
        await sendMessage(
          sock,
          remoteJid,
          {
            text: `Waktu Habis\nJawaban: ${jawaban}\nDeskripsi: ${deskripsi}\n\nIngin bermain? Ketik .cak lontong`,
          },
          { quoted: message }
        );
      } catch (error) {
        // Tanpa penangkap ini kegagalan kirim (mis. sesi sedang reconnect)
        // hilang diam-diam: permainannya sudah dihapus tapi pemain tidak
        // pernah diberi tahu jawabannya.
        logWithTime('Caklontong', `Gagal kirim pesan waktu habis: ${error?.message || error}`);
      }
    }, WAKTU_GAMES * 1000);

    // Permainannya bisa saja sudah selesai sebelum baris ini.
    if (isUserPlaying(remoteJid)) {
      dataGame.timer = timer;
    } else {
      clearTimeout(timer);
    }

    // Kirim pertanyaan ke pengguna
    await sendMessage(
      sock,
      remoteJid,
      { text: `*Jawablah Pertanyaan Berikut :*\n${soal}\n*Waktu : 60s*` },
      { quoted: message }
    );

    logWithTime("Caklontong", `Jawaban : ${jawaban}`);
  } catch (error) {
    // Jangan tinggalkan permainan setengah jadi di memori.
    removeUser(remoteJid);
    logWithTime('Caklontong', `Gagal memulai permainan: ${error?.message || error}`);

    await sendMessage(
      sock,
      remoteJid,
      { text: '⚠️ _Gagal memuat soal. Coba lagi sebentar lagi._' },
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
