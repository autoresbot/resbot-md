import { addBadword, updateBadword, findBadword } from "../../lib/badword.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, sender, prefix, command, content, fullText } =
    messageInfo;

  try {
    if (!content || !content.trim()) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
            prefix + command
          } tolol*_`,
        },
        { quoted: message }
      );
    }

    const args = fullText.trim().split(" ").slice(1);
    const dataGrub = await ensureGroupData("global-badword");
    const responseMessage = await addBadwordToList(
      "global-badword",
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

// Fungsi untuk menambahkan kata ke daftar badword
async function addBadwordToList(remoteJid, dataGrub, words) {
  if (words.length === 0) {
    return "⚠️ _Mohon berikan kata yang ingin ditambahkan. Contoh: .addbadword tolol_";
  }

  const newWords = words.filter((word) => !dataGrub.listBadword.includes(word));
  if (newWords.length === 0) {
    return "⚠️ _Semua kata sudah ada dalam daftar badword._";
  }

  dataGrub.listBadword.push(...newWords);
  await updateBadword(remoteJid, { listBadword: dataGrub.listBadword });
  return `✅ _Berhasil menambahkan kata:_ ${newWords.join(", ")}`;
}

// Fungsi untuk mengirim respons ke grup
async function sendResponse(sock, remoteJid, text, quotedMessage) {
  await sock.sendMessage(remoteJid, { text }, { quoted: quotedMessage });
}

export default {
  handle,
  Commands: ["addglobalbadword"],
  OnlyPremium: false,
  OnlyOwner: true,
};
