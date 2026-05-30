import {
  removeUser,
  getUser,
  isUserPlaying,
  updateUser,
  findDataByKey,
} from '../../database/temporary_db/suit.js';

import { sendMessageWithMention } from '../../lib/utils.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function determineWinner(choice1, choice2) {
  if (choice1 === choice2) return 'draw';

  const winningCombinations = {
    batu: 'gunting',
    gunting: 'kertas',
    kertas: 'batu',
  };

  return winningCombinations[choice1] === choice2 ? 'player1' : 'player2';
}

async function process(sock, messageInfo) {
  const { fullText, message, sender, senderLid, isGroup, senderType } = messageInfo;
  const { remoteJid } = messageInfo;

  let gameData = isGroup
    ? isUserPlaying(remoteJid)
      ? getUser(remoteJid)
      : null
    : findDataByKey({ player1: sender }) || findDataByKey({ player2: sender });

  if (!gameData) {
    return true;
  }

  const { player1, player2, groupId, status } = gameData;

  // PLAYER 2 TERIMA
  if (!status && player2 === sender) {
    if (fullText.toLowerCase() === 'terima') {
      updateUser(groupId, { status: true });

      const choices = ['batu', 'gunting', 'kertas'];

      // RANDOM PILIHAN BOT
      const choicePlayer1 = choices[Math.floor(Math.random() * choices.length)];

      const choicePlayer2 = choices[Math.floor(Math.random() * choices.length)];

      // SIMPAN HASIL
      updateUser(groupId, {
        answer_player1: choicePlayer1,
        answer_player2: choicePlayer2,
      });

      await sock.sendMessage(
        groupId,
        {
          text: `🎮 Suit dimulai...\n\nBot sedang memilih...`,
        },
        { quoted: message },
      );

      await delay(3000);

      const winner = determineWinner(choicePlayer1, choicePlayer2);

      let resultMessage;

      if (winner === 'player1') {
        resultMessage = `🎮 *HASIL SUIT*\n\n🏆 Pemenang: @${player1.split('@')[0]}\n\n👤 @${
          player1.split('@')[0]
        } memilih *${choicePlayer1}*\n👤 @${player2.split('@')[0]} memilih *${choicePlayer2}*`;
      } else if (winner === 'player2') {
        resultMessage = `🎮 *HASIL SUIT*\n\n🏆 Pemenang: @${player2.split('@')[0]}\n\n👤 @${
          player1.split('@')[0]
        } memilih *${choicePlayer1}*\n👤 @${player2.split('@')[0]} memilih *${choicePlayer2}*`;
      } else {
        resultMessage = `🎮 *HASIL SUIT*\n\n🤝 Hasil Seri!\n\n👤 @${
          player1.split('@')[0]
        } memilih *${choicePlayer1}*\n👤 @${player2.split('@')[0]} memilih *${choicePlayer2}*`;
      }

      removeUser(groupId);

      return await sendMessageWithMention(sock, groupId, resultMessage, message, senderType);
    } else if (fullText.toLowerCase() === 'tolak') {
      removeUser(groupId);

      return await sock.sendMessage(
        groupId,
        {
          text: `Permainan Suit dibatalkan karena tantangan ditolak.`,
        },
        { quoted: message },
      );
    }
  }

  // MENYERAH
  if (fullText.toLowerCase().includes('nyerah')) {
    removeUser(groupId);

    return await sock.sendMessage(
      groupId,
      {
        text: `Permainan Suit berakhir karena salah satu pemain menyerah.`,
      },
      { quoted: message },
    );
  }

  return true;
}

export const name = 'Suit';
export const priority = 9;
export { process };
