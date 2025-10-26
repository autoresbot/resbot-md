import { addBadword, findBadword } from "../../lib/badword.js";

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message } = messageInfo;
  if (!isGroup) return; // Hanya untuk grup

  try {
    // Ambil data badword grup tertentu dan daftar global
    const dataGrub = await ensureGroupData(remoteJid);
    const dataGrub2 = await ensureGroupData("global-badword");

    // Format daftar badword grup
    const badwordList =
      dataGrub.listBadword.length > 0
        ? dataGrub.listBadword.map((item) => `◧ ${item}`).join("\n")
        : "_(Tidak ada badword di grup ini)_";

    // Format daftar badword global
    const globalBadwordList =
      dataGrub2.listBadword.length > 0
        ? dataGrub2.listBadword.map((item) => `◧ ${item}`).join("\n")
        : "_(Tidak ada badword global)_";

    // Format pesan akhir
    const responseMessage =
      `*▧ 「 LIST BADWORDS 」*\n\n` +
      `*📌 List Badword Grup:*\n${badwordList}\n\n` +
      `*🌍 List Global Badword:*\n${globalBadwordList}
            
⚠️ _Noted_ ⚠️
.on badword (hapus)
.on badwordv2 (kick)
.on badwordv3 (peringatan (4x) lalu kick)`;

    // Kirim respons ke grup
    return await sendResponse(sock, remoteJid, responseMessage, message);
  } catch (error) {
    return await sendResponse(
      sock,
      remoteJid,
      "Terjadi kesalahan saat memproses perintah.",
      message
    );
  }
}

async function ensureGroupData(remoteJid) {
  let dataGrub = await findBadword(remoteJid);
  if (!dataGrub) {
    await addBadword(remoteJid, { listBadword: [] });
    dataGrub = { listBadword: [] };
  }
  return dataGrub;
}

async function sendResponse(sock, remoteJid, text, quotedMessage) {
  await sock.sendMessage(remoteJid, { text }, { quoted: quotedMessage });
}

export default {
  handle,
  Commands: ["badword", "listbadword"],
  OnlyPremium: false,
  OnlyOwner: false,
};
