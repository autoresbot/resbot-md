import ApiAutoresbotModule from 'api-autoresbot';
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from '../../config.js';
const api = new ApiAutoresbot(config.APIKEY);
import mess from '../../strings.js';

import { logWithTime } from '../../lib/utils.js';

const WAKTU_GAMES = 60; // 60 detik

import { addUser, removeUser, isUserPlaying } from '../../database/temporary_db/tebak hewan.js';

/** Samakan bentuk jawaban: huruf kecil, tanpa spasi berlebih. */
function rapikanJawaban(teks) {
  return String(teks || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, fullText } = messageInfo;

  if (!String(fullText || '').toLowerCase().includes('pemainbola')) {
    return true;
  }

  // Dicek SEBELUM memanggil API: dulu urutannya terbalik sehingga setiap
  // ketikan saat permainan berjalan tetap memakai satu permintaan ke server.
  if (isUserPlaying(remoteJid)) {
    return await sock.sendMessage(remoteJid, { text: mess.game.isPlaying }, { quoted: message });
  }

  try {
    const response = await api.get(`/api/game/pemain-bola`);

    const question_image = response.data.download_url;
    const answer = response.data.answer;

    // Soal yang tidak lengkap dulu tetap diteruskan sampai meledak saat
    // jawabannya diolah, dan isi error mentahnya ikut terkirim ke grup.
    if (!rapikanJawaban(answer)) {
      logWithTime('Tebak Pemain Bola', `Soal tidak lengkap dari server: ${JSON.stringify(response?.data)}`);
      return await sock.sendMessage(
        remoteJid,
        { text: '⚠️ _Soal sedang tidak tersedia. Coba lagi sebentar lagi._' },
        { quoted: message },
      );
    }

    // Data permainan disimpan DULU, timernya menyusul. Dengan urutan ini tidak
    // pernah ada timer yang berjalan tanpa data permainannya.
    const dataGame = {
      answer: rapikanJawaban(answer),
      hadiah: 10, // jumlah money jika menang
      command: fullText,
      timer: null,
    };

    addUser(remoteJid, dataGame);

    const timer = setTimeout(async () => {
      if (!isUserPlaying(remoteJid)) return;

      removeUser(remoteJid); // Hapus user dari database jika waktu habis

      try {
        if (mess.game_handler.waktu_habis) {
          const handlerTimeout = mess.game_handler.waktu_habis.replace('@answer', answer);

          await sock.sendMessage(remoteJid, { text: handlerTimeout }, { quoted: message });
        }
      } catch (error) {
        // Tanpa penangkap ini kegagalan kirim (mis. sesi sedang reconnect)
        // hilang diam-diam: permainannya sudah dihapus tapi pemain tidak
        // pernah diberi tahu jawabannya.
        logWithTime('Tebak Pemain Bola', `Gagal kirim pesan waktu habis: ${error?.message || error}`);
      }
    }, WAKTU_GAMES * 1000);

    // Permainannya bisa saja sudah selesai sebelum baris ini.
    if (isUserPlaying(remoteJid)) {
      dataGame.timer = timer;
    } else {
      clearTimeout(timer);
    }

    await sock.sendMessage(
      remoteJid,
      {
        image: { url: question_image },
        caption: `Sebutkan Nama Pemain Bola Di Atas\n\nWaktu : ${WAKTU_GAMES}s`,
      },
      { quoted: message },
    );

    logWithTime('Tebak Pemain Bola', `Jawaban : ${answer}`);
  } catch (error) {
    // Jangan tinggalkan permainan setengah jadi di memori.
    removeUser(remoteJid);
    logWithTime('Tebak Pemain Bola', `Gagal memulai permainan: ${error?.message || error}`);

    await sock.sendMessage(
      remoteJid,
      { text: '⚠️ _Gagal memuat soal. Coba lagi sebentar lagi._' },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['tebak', 'tebakpemainbola'],
  OnlyPremium: false,
  OnlyOwner: false,
};
