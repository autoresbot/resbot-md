import {
  removeUser,
  getUser,
  isUserPlaying,
} from "../../database/temporary_db/tebak bom.js";
import { addUser, updateUser, findUser } from "../../lib/users.js";
import mess from "../../strings.js";

async function process(sock, messageInfo) {
  const { remoteJid, fullText, message, sender } = messageInfo;

  if (isUserPlaying(remoteJid)) {
    const data = getUser(remoteJid);

    // Validasi input angka
    if (!/^\d+$/.test(fullText)) return;

    const guessedNumber = parseInt(fullText, 10);
    if (guessedNumber < 1 || guessedNumber > 9) return;

    if (guessedNumber === data.posisiBom) {
      handleUserLoss(sender, data, sock, message, remoteJid);
    } else {
      handleUserGuess(sender, guessedNumber, data, sock, message, remoteJid);
    }

    return false; // Menghentikan plugin berikutnya
  }

  return true; // Lanjutkan ke plugin berikutnya
}

async function handleUserLoss(sender, data, sock, message, remoteJid) {
  const user = await findUser(sender);
  const moneyKalah = data.moneyKalah;

  if (user) {
    const [docId, userData] = user;
    const moneyUpdate = (userData.money || 0) - moneyKalah;
    await updateUser(sender, { money: moneyUpdate });
  } else {
  }

  removeUser(remoteJid);
  await sock.sendMessage(
    remoteJid,
    {
      text: `*ANDA KALAH*\n\n_Nomor *${data.posisiBom}* adalah 💣_\n\n_Money Anda -${moneyKalah}_`,
    },
    { quoted: message }
  );
  return false;
}

async function handleUserGuess(
  sender,
  guessedNumber,
  data,
  sock,
  message,
  remoteJid
) {
  if (data.terjawab.includes(guessedNumber)) {
    return;
  }

  const user = await findUser(sender);

  data.terjawab.push(guessedNumber);
  await updateUser(sender, { terjawab: data.terjawab });

  if (data.terjawab.length >= 8) {
    removeUser(remoteJid);

    if (user) {
      const [docId, userData] = user;
      const moneyUpdate = (userData.money || 0) + data.moneyMenang;
      await updateUser(sender, { money: moneyUpdate });
    } else {
    }

    await sock.sendMessage(
      remoteJid,
      {
        text: `_*Yeahh Anda Menang !*_\n\n_Money Anda *+${data.moneyMenang}*_`,
      },
      { quoted: message }
    );
    return false;
  }

  if (user) {
    const [docId, userData] = user;
    const moneyUpdate = (userData.money || 0) + data.hadiah;
    await updateUser(sender, { money: moneyUpdate });
  } else {
  }

  const updatedView = updateView(data, guessedNumber);
  await sock.sendMessage(
    remoteJid,
    {
      text: `${updatedView}\n\n_*Money Anda +${data.hadiah}*_`,
    },
    { quoted: message }
  );
}

function updateView(data, guessedNumber) {
  const hurufMap = {
    1: "A",
    2: "B",
    3: "C",
    4: "D",
    5: "E",
    6: "F",
    7: "G",
    8: "H",
    9: "I",
  };
  const arrayBuah = data.ListBuah;

  if (guessedNumber >= 1 && guessedNumber <= 9) {
    const huruf = hurufMap[guessedNumber];
    const [row, col] = [((guessedNumber - 1) / 3) | 0, (guessedNumber - 1) % 3];
    data.bomView_User = data.bomView_User.replace(huruf, arrayBuah[row][col]);
  }

  return formatView(data.bomView_User);
}

function formatView(view) {
  const hurufToEmoji = {
    A: "1️⃣",
    B: "2️⃣",
    C: "3️⃣",
    D: "4️⃣",
    E: "5️⃣",
    F: "6️⃣",
    G: "7️⃣",
    H: "8️⃣",
    I: "9️⃣",
  };

  return view
    .split(" ")
    .map((huruf) => hurufToEmoji[huruf] || huruf)
    .reduce((acc, emoji, idx) => {
      acc += emoji + ((idx + 1) % 3 === 0 ? "\n" : "");
      return acc;
    }, "");
}

export const name = "Tebak Angka";
export const priority = 10;
export { process };
