import { getGroupMetadata } from "../../lib/cache.js";
import { deleteBadword } from "../../lib/badword.js";
import { deleteGroup } from "../../lib/group.js";
import { deleteAllListInGroup } from "../../lib/list.js";
import fs from "fs";
import path from "path";
import mess from "../../strings.js";

// Menggunakan cwd untuk menentukan path absolut file JSON
const absenJson = path.join(
  process.cwd(),
  "database",
  "additional",
  "absen.json"
);
const groupParticipantJson = path.join(
  process.cwd(),
  "database",
  "additional",
  "group participant.json"
);
const totalChatJson = path.join(
  process.cwd(),
  "database",
  "additional",
  "totalchat.json"
);
const badwordJson = path.join(process.cwd(), "database", "badword.json");
const slrJson = path.join(process.cwd(), "database", "slr.json");
const listJson = path.join(process.cwd(), "database", "list.json");

// Fungsi untuk memeriksa apakah pengirim adalah admin grup
async function isAdmin(sock, remoteJid, sender) {
  try {
    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    const participants = groupMetadata.participants;
    return participants.some(
      (p) => (p.phoneNumber === sender || p.id === sender) && p.admin
    );
  } catch (error) {
    return false;
  }
}

// Fungsi utama untuk mereset grup
async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender } = messageInfo;

  // Pastikan hanya grup yang dapat menjalankan fitur ini
  if (!isGroup) return;

  try {
    // Periksa apakah pengirim adalah admin grup
    const adminStatus = await isAdmin(sock, remoteJid, sender);
    if (!adminStatus) {
      await sock.sendMessage(
        remoteJid,
        { text: mess.general.isAdmin },
        { quoted: message }
      );
      return;
    }

    // Lakukan reset grup untuk remoteJid tertentu
    await resetGroupSettings(remoteJid);

    // Kirim pesan konfirmasi setelah reset berhasil
    await sock.sendMessage(
      remoteJid,
      { text: "Pengaturan grup ini telah berhasil direset." },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error in resetgc command:", error);

    // Kirim pesan kesalahan jika terjadi error
    await sock.sendMessage(
      remoteJid,
      { text: "⚠️ Terjadi kesalahan saat mereset pengaturan grup." },
      { quoted: message }
    );
  }
}

// Fungsi untuk mereset pengaturan grup berdasarkan remoteJid
async function resetGroupSettings(remoteJid) {
  try {
    // Membaca data dari semua file JSON
    const absenData = JSON.parse(fs.readFileSync(absenJson, "utf8"));
    const groupParticipantData = JSON.parse(
      fs.readFileSync(groupParticipantJson, "utf8")
    );
    const totalChatData = JSON.parse(fs.readFileSync(totalChatJson, "utf8"));
    const badwordData = JSON.parse(fs.readFileSync(badwordJson, "utf8"));
    const slrData = JSON.parse(fs.readFileSync(slrJson, "utf8"));
    const listData = JSON.parse(fs.readFileSync(listJson, "utf8"));

    // Reset data di file absen.json jika ada
    if (absenData[remoteJid]) {
      delete absenData[remoteJid];
      fs.writeFileSync(absenJson, JSON.stringify(absenData, null, 2));
    } else {
    }

    // Reset data di file group participant.json jika ada
    if (groupParticipantData[remoteJid]) {
      delete groupParticipantData[remoteJid];
      fs.writeFileSync(
        groupParticipantJson,
        JSON.stringify(groupParticipantData, null, 2)
      );
    } else {
    }

    // Reset data di file totalchat.json jika ada
    if (totalChatData[remoteJid]) {
      delete totalChatData[remoteJid];
      fs.writeFileSync(totalChatJson, JSON.stringify(totalChatData, null, 2));
    } else {
    }

    // Reset data di file badword.json jika ada
    if (badwordData[remoteJid]) {
      delete badwordData[remoteJid];
      fs.writeFileSync(badwordJson, JSON.stringify(badwordData, null, 2));
    } else {
    }

    // Reset data di file slr.json jika ada
    if (slrData[remoteJid]) {
      delete slrData[remoteJid];
      fs.writeFileSync(slrJson, JSON.stringify(slrData, null, 2));
    } else {
    }

    // Reset data di file list.json jika ada
    if (listData[remoteJid]) {
      delete listData[remoteJid];
      fs.writeFileSync(listJson, JSON.stringify(listData, null, 2));
    } else {
    }

    await deleteGroup(remoteJid);
    await deleteBadword(remoteJid);
    await deleteAllListInGroup(remoteJid);
  } catch (error) {
    throw new Error("Gagal mereset pengaturan grup.");
  }
}

export default {
  handle,
  Commands: ["resetgc"],
  OnlyPremium: false,
  OnlyOwner: false,
};
