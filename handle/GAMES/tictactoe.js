import {
  removeUser,
  getUser,
  isUserPlaying,
  updateGame,
} from "../../database/temporary_db/tictactoe.js";
import { sendMessageWithMention } from "../../lib/utils.js";

const SYMBOLS = {
  X: "❌",
  O: "⭕",
  1: "1️⃣",
  2: "2️⃣",
  3: "3️⃣",
  4: "4️⃣",
  5: "5️⃣",
  6: "6️⃣",
  7: "7️⃣",
  8: "8️⃣",
  9: "9️⃣",
};

async function process(sock, messageInfo) {
  const { remoteJid, fullText, message, sender, senderType } = messageInfo;

  // Cek apakah ada permainan aktif
  if (!isUserPlaying(remoteJid)) {
    return true; // Lanjutkan ke plugin berikutnya
  }

  const data = getUser(remoteJid);

  const lowerText = fullText.toLowerCase();

  // Penanganan menyerah
  if (lowerText.includes("nyerah")) {
    removeUser(remoteJid);
    await sock.sendMessage(
      remoteJid,
      {
        text: `Yahh menyerah 😢\nGame dibatalkan!\n\nIngin bermain? Ketik *.tictactoe*`,
      },
      { quoted: message }
    );
    return false; // Proses selesai
  }

  // Penanganan tantangan permainan
  if (lowerText.includes("ttc") || lowerText.includes("tictactoe")) {
    if (data.playerX === sender) return false; // Pemain yang sama tidak bisa bermain melawan diri sendiri
    if (data.state === "PLAYING") return false; // Permainan sudah dimulai

    // Perbarui data permainan
    data.playerO = sender;
    data.game.playerO = sender;
    data.state = "PLAYING";
    updateGame(remoteJid, data);

    // Render papan permainan
    const board = data.game.render().map((v) => SYMBOLS[v] || v);
    const gameBoard = `
Room ID: ${data.id_room}

${board.slice(0, 3).join("")}
${board.slice(3, 6).join("")}
${board.slice(6).join("")}

Menunggu @${data.game.currentTurn.split("@")[0]}

Ketik *nyerah* untuk menyerah dan mengakui kekalahan
        `.trim();

    await sendMessageWithMention(
      sock,
      remoteJid,
      gameBoard,
      message,
      senderType
    );
    return false; // Proses selesai
  }

  // Handle jawaban ttc - Giliran pemain

  const match = fullText.match(/^\d$/); // Mencocokkan angka 1-9
  if (match) {
    const move = parseInt(match[0], 10) - 1; // Ubah ke indeks (0-8)
    const player = sender === data.playerX ? 0 : 1;

    // Eksekusi giliran
    const result = data.game.turn(player, move);

    // Evaluasi hasil giliran
    if (result === -1) {
      return;
    } else if (result === 0) {
      return;
    } else if (result === -2) {
      return;
    } else if (result === -3) {
      removeUser(remoteJid);
      await sock.sendMessage(
        remoteJid,
        { text: `Game selesai! Tidak ada pemenang.` },
        { quoted: message }
      );
    } else {
      const board = data.game.render().map((v) => SYMBOLS[v] || v);
      const boardDisplay = `
Room ID: ${data.id_room}

${board.slice(0, 3).join("")}
${board.slice(3, 6).join("")}
${board.slice(6).join("")}

Giliran @${data.game.currentTurn.split("@")[0]}

Ketik angka 1-9 untuk bermain.
            `.trim();

      await sendMessageWithMention(sock, remoteJid, boardDisplay, message);

      // Cek pemenang
      const winner = data.game.winner;
      if (winner) {
        removeUser(remoteJid);
        await sendMessageWithMention(
          sock,
          remoteJid,
          `Selamat! 🎉 @${winner.split("@")[0]} memenangkan permainan.`,
          message
        );
      }
    }

    return false;
  }

  return true; // Lanjutkan ke plugin berikutnya
}

export const name = "Tictactoe";
export const priority = 10;
export { process };
