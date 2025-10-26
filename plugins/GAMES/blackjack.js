import {
  addUser,
  isUserPlaying,
} from "../../database/temporary_db/blackjack.js";
import { findUser, updateUser } from "../../lib/users.js";

let mode = "hard"; // normal, hard, setan (mode setan gk mungkin menang)

let kartu_blackjack_player = [];
let kartu_blackjack_computer = [];

if (mode === "normal") {
  kartu_blackjack_player = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "J",
    "K",
    "Q",
  ];
  kartu_blackjack_computer = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "J",
    "K",
    "Q",
  ];
} else if (mode === "hard") {
  kartu_blackjack_player = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "J",
    "K",
    "Q",
  ];
  kartu_blackjack_computer = ["8", "9", "J", "K", "Q"];
} else if (mode === "setan") {
  kartu_blackjack_player = ["A", "2", "3", "4", "5", "6", "7", "8", "9"];
  kartu_blackjack_computer = ["J", "K", "Q"];
}

function getRandomCard(deck) {
  return deck[Math.floor(Math.random() * deck.length)];
}

// Fungsi untuk menghitung nilai kartu
function getNilaiKartu_Blackjack(kartu) {
  return kartu.reduce((total, kartu) => {
    if (["J", "Q", "K"].includes(kartu)) return total + 10;
    if (kartu === "A") return total + 1; // Bisa diatur menjadi 1 atau 11
    return total + (parseInt(kartu) || 0);
  }, 0);
}

// Fungsi untuk menangani game
async function handle(sock, messageInfo) {
  const { remoteJid, message, content, fullText, sender } = messageInfo;

  // Periksa jika user sedang bermain
  if (isUserPlaying(sender)) {
    return await sock.sendMessage(
      remoteJid,
      { text: "⚠️ _Permainan blackjack sedang berlangsung._" },
      { quoted: message }
    );
  }

  // Validasi input taruhan
  const taruhan = parseInt(content);
  if (!taruhan || taruhan <= 0) {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `_Masukkan jumlah taruhan yang valid (contoh: *.blackjack 500*)_`,
      },
      { quoted: message }
    );
  }

  // Ambil data user
  const dataUsers = await findUser(sender);
  if (!dataUsers) {
    return await sock.sendMessage(
      remoteJid,
      { text: "Data user tidak ditemukan!" },
      { quoted: message }
    );
  }

  const [docId, userData] = dataUsers;

  const moneyUsers = userData.money || 0;
  if (moneyUsers < taruhan) {
    return await sock.sendMessage(
      remoteJid,
      { text: `Money Anda tidak cukup.\n\nMoney Anda: ${moneyUsers}` },
      { quoted: message }
    );
  }

  const playerCards = [
    getRandomCard(kartu_blackjack_player),
    getRandomCard(kartu_blackjack_player),
  ];
  const computerCards = [
    getRandomCard(kartu_blackjack_computer),
    getRandomCard(kartu_blackjack_computer),
  ];

  const totalPlayer = getNilaiKartu_Blackjack(playerCards);

  // Update saldo user
  const updatedMoney = moneyUsers - taruhan;
  await updateUser(sender, { money: updatedMoney });

  // Tambahkan user ke game
  addUser(sender, {
    playerCards,
    computerCards,
    taruhan,
    mode,
  });

  const replyMessage = `🎰 *BLACKJACK* 🎰

🃏 Kartu Kamu: ${playerCards.join(", ")}
🎯 Total: ${totalPlayer}

💻 Kartu Komputer: ${computerCards[0]}, ?

💰 Taruhan: *${taruhan}*

Ketik *hit* untuk mengambil kartu tambahan.
Ketik *stand* untuk mengakhiri giliran.`;

  await sock.sendMessage(
    remoteJid,
    { text: replyMessage },
    { quoted: message }
  );
}

export default {
  handle,
  Commands: ["bj", "blackjack"],
  OnlyPremium: false,
  OnlyOwner: false,
};
