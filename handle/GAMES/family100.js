import {
  removeUser,
  getUser,
  isUserPlaying,
} from "../../database/temporary_db/family100.js";
import { sendMessageWithMention } from "../../lib/utils.js";
import { addUser, updateUser, deleteUser, findUser } from "../../lib/users.js";

async function process(sock, messageInfo) {
  const { remoteJid, fullText, message, sender, senderType } = messageInfo;

  // Periksa apakah pengguna sedang bermain
  if (!isUserPlaying(remoteJid)) {
    return true; // Lanjutkan ke plugin berikutnya
  }

  const data = getUser(remoteJid);

  // Validasi struktur data
  if (!data || !data.answer || !Array.isArray(data.answer)) {
    console.error(
      "Data pengguna tidak valid atau jawaban tidak ditemukan:",
      data
    );
    return true; // Lanjutkan jika data tidak valid
  }

  let isSurrender = fullText.toLowerCase().includes("nyerah");
  let isWin = false;

  // Jika pengguna menyerah
  if (isSurrender) {
    // Jika menyerah, tampilkan semua jawaban dan tag pengguna yang menjawab
    data.terjawab = data.terjawab.map((item) => item || ""); // Tandai jawaban yang belum terjawab sebagai kosong
  } else {
    // Periksa jawaban
    const normalizedAnswer = fullText.toLowerCase().replace(/[^\w\s\-]+/, "");
    const index = data.answer.findIndex(
      (answer) =>
        answer.toLowerCase().replace(/[^\w\s\-]+/, "") === normalizedAnswer
    );

    // Validasi index dan jawaban
    if (index === -1 || data.terjawab[index]) {
      return true; // Jawaban tidak valid atau sudah terjawab
    }

    // Tandai jawaban sebagai terjawab
    data.terjawab[index] = sender;

    // Periksa apakah semua jawaban telah terjawab
    isWin = data.terjawab.every(Boolean);
  }

  // Format pesan hasil
  const hasSpacedAnswer = data.answer.some((answer) => answer.includes(" "));
  const caption = `
*Jawablah Pertanyaan Berikut :*
${data.soal}

Terdapat ${data.answer.length} Jawaban ${
    hasSpacedAnswer ? `(beberapa jawaban terdapat spasi)` : ""
  }
${
  isWin
    ? `Semua jawaban telah terjawab! 🎉`
    : isSurrender
    ? "Menyerah! Berikut semua jawabannya:"
    : ""
}
${data.answer
  .map((jawaban, index) =>
    // Tampilkan semua jawaban jika menyerah, atau hanya yang sudah terjawab saat bermain
    isSurrender || data.terjawab[index]
      ? `(${index + 1}) ${jawaban} ${
          data.terjawab[index] ? `@${data.terjawab[index].split("@")[0]}` : ""
        }`
      : null
  )
  .filter(Boolean) // Hapus jawaban yang belum terjawab saat bermain
  .join("\n")}`.trim();

  const hadiahPerJawabanBenar = data.hadiahPerJawabanBenar;
  const hadiahJikaMenang = data.hadiahJikaMenang;
  let MoneyClaim;

  if (!isSurrender) {
    // Hadiah tidak nyerah

    // Mencari pengguna
    const user = await findUser(sender);

    if (isWin) {
      MoneyClaim = hadiahJikaMenang;
    } else {
      // jika jawaban tepat
      MoneyClaim = hadiahPerJawabanBenar;
    }

    if (user) {
      const [docId, userData] = user;
      const moneyAdd = (userData.money || 0) + MoneyClaim; // Default money ke 0 jika undefined
      await updateUser(sender, { money: moneyAdd });
    } else {
    }
  }

  if (isWin) {
    // Kirim pesan dengan mention
    await sendMessageWithMention(
      sock,
      remoteJid,
      `🎉 Selamat! Semua Jawaban telah terjawab. Anda mendapatkan ${MoneyClaim} Money.`,
      message,
      senderType
    );
  } else {
    if (!isSurrender) {
      const captionNew = `Jawaban Benar anda dapat ${MoneyClaim} Money\n\n${caption}`;
      // Kirim pesan dengan mention
      await sendMessageWithMention(
        sock,
        remoteJid,
        captionNew,
        message,
        senderType
      );
      return true;
    }

    // Kirim pesan dengan mention
    await sendMessageWithMention(sock, remoteJid, caption, message, senderType);
  }

  if (isWin || isSurrender) {
    // Hapus pengguna dari permainan setelah selesai atau nyerah
    removeUser(remoteJid);
  }

  return true;
}

export const name = "Family 100";
export const priority = 10;
export { process };
