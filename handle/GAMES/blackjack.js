import { removeUser, getUser, isUserPlaying } from '../../database/temporary_db/blackjack.js';
import { updateUser, findUser } from '../../lib/users.js';
import { danger } from '../../lib/utils.js';
import config from '../../config.js';

const kartu_blackjack = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'J', 'K', 'Q'];
const kartu_blackjack_setan = ['9', 'J', 'K', 'Q'];

// Fungsi untuk menghitung nilai kartu
function getNilaiKartu_Blackjack(kartu) {
  return kartu.reduce((total, kartu) => {
    if (['J', 'Q', 'K'].includes(kartu)) return total + 10;
    if (kartu === 'A') return total + 1; // Bisa diatur menjadi 1 atau 11
    return total + (parseInt(kartu) || 0);
  }, 0);
}

// Fungsi untuk menangani hasil perbandingan kartu
function getGameResult(userTotal, compTotal, taruhan, data) {
  let resultMessage = '';
  let moneyChange = 0;
  let action = '';

  if (userTotal > compTotal) {
    moneyChange = taruhan * 2;
    action = 'win';
    //resultMessage = `*KAMU MENANG*\n\nKartu Kamu: ${userTotal}\nKartu Komputer: ${compTotal}\n\nKamu Dapat *+${moneyChange}* Money`;
    resultMessage = `🎰 *KAMU MENANG* 🎰

🃏 Kartu Kamu: ${data.playerCards.join(', ')}
🎯 Total: ${userTotal}

💻 Kartu Komputer: ${data.computerCards.join(', ')}
🎯 Total: ${compTotal}

💰 Kamu Dapat *+${moneyChange}*`;
  } else if (userTotal === compTotal) {
    moneyChange = taruhan;
    action = 'draw';
    //resultMessage = `*PEMAINAN SERI*\n\nKartu Kamu: ${userTotal}\nKartu Komputer: ${compTotal}\n\nMoney Anda *+${moneyChange}*`;

    resultMessage = `🎰 *PEMAINAN SERI* 🎰

🃏 Kartu Kamu: ${data.playerCards.join(', ')}
🎯 Total: ${userTotal}

💻 Kartu Komputer: ${data.computerCards.join(', ')}
🎯 Total: ${compTotal}

💰 Money Anda *+${moneyChange}*`;
  } else {
    moneyChange = taruhan;
    action = 'lost';
    //resultMessage = `*KAMU KALAH*\n\nKartu Kamu: ${userTotal}\nKartu Komputer: ${compTotal}\n\nMoney Anda *-${moneyChange}*`;

    resultMessage = `🎰 *KAMU KALAH* 🎰

🃏 Kartu Kamu: ${data.playerCards.join(', ')}
🎯 Total: ${userTotal}

💻 Kartu Komputer: ${data.computerCards.join(', ')}
🎯 Total: ${compTotal}

💰 Money Anda *-${moneyChange}*`;
  }

  return { resultMessage, moneyChange, action };
}

const rateLimiter = {};

async function process(sock, messageInfo) {
  const { remoteJid, pushName, fullText, message, sender, senderLid } = messageInfo;

  const now = Date.now();
  const rateLimit = config.rate_limit;

  // Cek apakah pengguna sedang bermain
  if (isUserPlaying(senderLid)) {
    const data = getUser(senderLid);

    const user = await findUser(senderLid, 'Debug 7');

    const [docId, userData] = user;

    if (fullText.toLowerCase().includes('stand')) {
      if (rateLimiter[senderLid]) {
        const timeSinceLastMessage = now - rateLimiter[senderLid];
        if (timeSinceLastMessage < rateLimit) {
          danger(pushName, `Rate limit : ${fullText}`);
          return false;
        }
      }
      rateLimiter[senderLid] = now;

      const userCards = data.playerCards;
      const compCards = data.computerCards;

      // Hitung total kartu
      const userTotal = getNilaiKartu_Blackjack(userCards);
      const compTotal = getNilaiKartu_Blackjack(compCards);

      const taruhan = data.taruhan;

      const { resultMessage, moneyChange, action } = getGameResult(
        userTotal,
        compTotal,
        taruhan,
        data,
      );

      // Update saldo pengguna
      const currentBalance = userData.money || 0;
      const actions = {
        win: currentBalance + moneyChange,
        lost: currentBalance,
        draw: currentBalance + moneyChange,
      };

      const newBalance =
        actions[action] ??
        (() => {
          throw new Error(`Unknown action: ${action}`);
        })();

      updateUser(senderLid, { money: newBalance });

      // Hapus pengguna dari daftar permainan
      removeUser(senderLid);

      // Kirimkan pesan hasil permainan
      await sock.sendMessage(remoteJid, { text: resultMessage }, { quoted: message });

      return false;
    } else if (fullText.toLowerCase().includes('hit')) {
      if (rateLimiter[senderLid]) {
        const timeSinceLastMessage = now - rateLimiter[senderLid];
        if (timeSinceLastMessage < rateLimit) {
          danger(pushName, `Rate limit [BJ] : ${fullText}`);
          return false;
        }
      }
      rateLimiter[senderLid] = now;
      // Ambil kartu tambahan

      let userkartu3 = kartu_blackjack[Math.floor(Math.random() * kartu_blackjack.length)];

      const totalBiji = getNilaiKartu_Blackjack(data.playerCards);
      if (totalBiji > 13 && data.mode == 'setan') {
        userkartu3 =
          kartu_blackjack_setan[Math.floor(Math.random() * kartu_blackjack_setan.length)];
      }

      if (data.mode == 'hard' && userData.money > 10000 && totalBiji > 13) {
        // jika mode hard dan money user lebih 100000 kalahkan dia
        userkartu3 =
          kartu_blackjack_setan[Math.floor(Math.random() * kartu_blackjack_setan.length)];
      }

      data.playerCards.push(userkartu3); // Menambahkan kartu ke tangan pemain

      const userTotal = getNilaiKartu_Blackjack(data.playerCards);
      const compTotal = getNilaiKartu_Blackjack(data.computerCards);

      // Periksa apakah total kartu pemain lebih dari 21
      if (userTotal > 21) {
        const taruhan = data.taruhan;
        const resultMessage = `🎰 *KAMU KALAH* 🎰

🃏 Kartu Kamu: ${data.playerCards.join(', ')}
🎯 Total: ${userTotal}

💻 Kartu Komputer: ${data.computerCards.join(', ')}
🎯 Total: ${compTotal}

💰 Money Anda *-${taruhan}*`;

        // Hapus pengguna dari permainan
        removeUser(senderLid);

        // Kirim pesan kalah
        await sock.sendMessage(remoteJid, { text: resultMessage }, { quoted: message });
      } else {
        const resultMessage = `🎰 *BLACKJACK* 🎰

🃏 Kartu Kamu: ${data.playerCards.join(', ')}
🎯 Total: ${userTotal}

💻 Kartu Komputer: ${data.computerCards[0]}, ?

💰 Taruhan: ${data.taruhan}

Ketik *.hit* untuk mengambil kartu tambahan atau *.stand* untuk mengakhiri giliran`;

        // Kirimkan pesan untuk opsi lanjutan
        await sock.sendMessage(remoteJid, { text: resultMessage }, { quoted: message });
      }

      return false;
    }
  }

  return true; // Lanjutkan ke plugin berikutnya
}

export const name = 'Blackjack';
export const priority = 10;
export { process };
