import mess from "../../strings.js";
import {
  addUser,
  removeUser,
  getUser,
  isUserPlaying,
} from "../../database/temporary_db/tebak bom.js";
import { logWithTime } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, fullText } = messageInfo;

  // Periksa apakah pesan mengandung kata "bom"
  if (!String(fullText || '').toLowerCase().includes('bom')) return true;

  // Periksa apakah pengguna sedang bermain
  if (isUserPlaying(remoteJid)) {
    await sock.sendMessage(
      remoteJid,
      { text: mess.game.isPlaying },
      { quoted: message }
    );
    return;
  }

  // Buah dan bom
  const buah = [
    "🍏",
    "🍎",
    "🍐",
    "🍊",
    "🍋",
    "🍉",
    "🍇",
    "🍓",
    "🍒",
    "🍑",
    "🥭",
    "🍅",
  ];

  const acakArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  const tambahBom = (grid) => {
    const posisiBom = Math.floor(Math.random() * 9);
    grid[Math.floor(posisiBom / 3)][posisiBom % 3] = "💣";
    return posisiBom + 1;
  };

  // Generate grid buah
  const grid = [
    acakArray(buah.slice(0, 3)),
    acakArray(buah.slice(3, 6)),
    acakArray(buah.slice(6, 9)),
  ];

  const posisiBomReal = tambahBom(grid);

  const bomView_User = `1️⃣ 2️⃣ 3️⃣\n4️⃣ 5️⃣ 6️⃣\n7️⃣ 8️⃣ 9️⃣`;
  const bomView_User_Abjad = `A B C D E F G H I`;

  // Tambahkan pengguna ke database
  addUser(remoteJid, {
    posisiBom: posisiBomReal,
    terjawab: [],
    ListBuah: grid,
    bomView_User: bomView_User_Abjad,
    hadiah: 5, // Jumlah money jika menang
    moneyMenang: 10,
    moneyKalah: 25, // Jumlah pengurangan jika kalah
    command: fullText,
  });

  logWithTime("Tebak Bom", `Posisibom : ${posisiBomReal}`);

  // Kirim pesan awal permainan
  await sock.sendMessage(
    remoteJid,
    { text: `_*Tebak Bom Dimulai*_\n\n${bomView_User}` },
    { quoted: message }
  );
}

export default {
  handle,
  Commands: ["tebak", "tebakbom"],
  OnlyPremium: false,
  OnlyOwner: false,
};
