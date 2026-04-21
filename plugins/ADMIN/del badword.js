import { addBadword, updateBadword, findBadword } from "../../lib/badword.js";
import { getGroupMetadata } from "../../lib/cache.js";
import mess from "../../strings.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, sender, command, fullText } = messageInfo;

  try {
    // Mendapatkan metadata grup
    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    const participants = groupMetadata.participants;
    const isAdmin = participants.some(
      (p) => (p.phoneNumber === sender || p.id === sender) && p.admin
    );
    if (!isAdmin) {
      await sock.sendMessage(
        remoteJid,
        { text: mess.general.isAdmin },
        { quoted: message }
      );
      return;
    }

    // Pastikan data grup tersedia
    let dataGrub = await ensureGroupData(remoteJid);

    // Ambil argumen dari pesan
    const args = fullText.trim().split(" ").slice(1);
    let responseMessage = await removeBadwordFromList(
      remoteJid,
      dataGrub,
      args
    );

    // Kirim respons ke grup
    await sendResponse(sock, remoteJid, responseMessage, message);
  } catch (error) {
    await sendResponse(
      sock,
      remoteJid,
      "Terjadi kesalahan saat memproses perintah.",
      message
    );
  }
}

// Fungsi tambahan untuk memastikan data grup tersedia
async function ensureGroupData(remoteJid) {
  let dataGrub = await findBadword(remoteJid);
  if (!dataGrub) {
    await addBadword(remoteJid, { listBadword: [] });
    dataGrub = { listBadword: [] };
  }
  return dataGrub;
}

// Fungsi untuk menghapus kata dari daftar badword
async function removeBadwordFromList(remoteJid, dataGrub, words) {
  if (words.length === 0) {
    return "⚠️ _Mohon berikan kata yang ingin dihapus._";
  }

  const deletedWords = [];
  dataGrub.listBadword = dataGrub.listBadword.filter((word) => {
    // Ubah semua kata menjadi huruf kecil untuk perbandingan
    const lowerCaseWord = word.toLowerCase();
    const lowerCaseWords = words.map((w) => w.toLowerCase());

    if (lowerCaseWords.includes(lowerCaseWord)) {
      deletedWords.push(word);
      return false;
    }
    return true;
  });

  if (deletedWords.length === 0) {
    return "⚠️ _Tidak ada kata yang ditemukan di dalam daftar badword._";
  }

  await updateBadword(remoteJid, { listBadword: dataGrub.listBadword });
  return `✅ _Kata berikut berhasil dihapus dari daftar badword:_ ${deletedWords.join(
    ", "
  )}`;
}

// Fungsi untuk mengirim respons ke grup
async function sendResponse(sock, remoteJid, text, quotedMessage) {
  await sock.sendMessage(remoteJid, { text }, { quoted: quotedMessage });
}

export default {
  handle,
  Commands: ["delbadword"],
  OnlyPremium: false,
  OnlyOwner: false,
};
