import mess from "../../strings.js";
import {
  addUser,
  removeUser,
  getUser,
  isUserPlaying,
} from "../../database/temporary_db/tictactoe.js";
import TicTacToe from "../../lib/games/tictactoe.js";

const WAKTU_GAMES = 60; // 60 detik

async function handle(sock, messageInfo) {
  const { remoteJid, message, sender, isGroup, command } = messageInfo;

  const groupOnlyMessage = { text: mess.game.isGroup };
  const waitingMessage = `Menunggu partner (${WAKTU_GAMES} s)... \n\nKetik *${command}* untuk menanggapi`;
  const timeoutMessage = `⏳ Waktu habis! Tidak ada lawan yang ingin bermain`;

  // Cek apakah permainan di grup
  if (!isGroup) {
    return sock.sendMessage(remoteJid, groupOnlyMessage, { quoted: message });
  }

  // Cek apakah user sedang bermain
  const isPlaying = isUserPlaying(remoteJid);
  if (isPlaying) {
    const currentGame = getUser(remoteJid);
    if (currentGame.state === "PLAYING") return true;
    await sock.sendMessage(
      remoteJid,
      { text: mess.game.isPlaying },
      { quoted: message }
    );
    return true;
  }

  // Tambahkan pengguna ke database
  addUser(remoteJid, {
    id_room: remoteJid,
    playerX: sender,
    playerO: null,
    state: "WAITING",
    game: new TicTacToe(sender, "o"),
  });

  // Set timer untuk 120 detik
  setTimeout(async () => {
    if (isUserPlaying(remoteJid)) {
      const currentGame = getUser(remoteJid);
      if (currentGame.state === "PLAYING") return true;

      removeUser(remoteJid); // Hapus user jika waktu habis
      await sock.sendMessage(
        remoteJid,
        { text: timeoutMessage },
        { quoted: message }
      );
      return true;
    }
  }, WAKTU_GAMES * 1000);

  // Kirim pesan menunggu
  await sock.sendMessage(
    remoteJid,
    { text: waitingMessage },
    { quoted: message }
  );
  return true;
}

export default {
  handle,
  Commands: ["ttc", "ttt", "tictactoe"],
  OnlyPremium: false,
  OnlyOwner: false,
};
