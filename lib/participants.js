import fs from "fs/promises";
import { updateSocket } from "./scheduled.js";
const pathjson_participant = "./database/additional/group participant.json";
import { logWithTime, cleanText } from "./utils.js";
import {
  getCache,
  setCache,
  deleteCache,
  entriesCache,
  sizeCache,
} from "./globalCache.js";

// Mengecek apakah file ada
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Fungsi untuk membaca file JSON
async function readJsonFile() {
  try {
    let currentParticipant;
    const cachedData = getCache(`group-participant`);
    if (cachedData) {
      currentParticipant = cachedData.data; // Menggunakan data dari cache
    } else {
      if (!(await fileExists(pathjson_participant))) {
        await fs.writeFile(
          pathjson_participant,
          JSON.stringify({}, null, 2),
          "utf8"
        ); // Buat file jika belum ada
      }
      const data = await fs.readFile(pathjson_participant, "utf8");
      currentParticipant = JSON.parse(data);
      setCache(`group-participant`, currentParticipant);
    }
    return currentParticipant;
  } catch (err) {
    if (err.code === "ENOENT") {
      // Jika file tidak ada, buat file baru dengan struktur kosong
      await fs.writeFile(pathjson_participant, JSON.stringify({}));
      return {};
    } else {
      throw err;
    }
  }
}

let isWriting = false;

async function writeJsonFile(data) {
  while (isWriting) {
    await new Promise((resolve) => setTimeout(resolve, 10)); // Tunggu jika proses lain sedang menulis
  }

  isWriting = true;
  try {
    await fs.writeFile(pathjson_participant, JSON.stringify(data, null, 2));
    deleteCache("group-participant");
    logWithTime("DELETE CACHE FILE", `group participant.json`, "merah");
  } catch (err) {
    console.error("Error writing to JSON file:", err);
    throw err;
  } finally {
    isWriting = false;
  }
}

async function setWelcome(remoteJid, text) {
  const data = await readJsonFile();
  if (!data[remoteJid]) {
    data[remoteJid] = {};
  }

  const cleanTxt = text ? cleanText(text) : "Selamat datang di grup!";

  data[remoteJid].add = cleanTxt;
  await writeJsonFile(data);
}

async function setLeft(remoteJid, text) {
  const data = await readJsonFile();
  if (!data[remoteJid]) {
    data[remoteJid] = {};
  }
  const cleanTxt = text ? cleanText(text) : "Selamat jalan, semoga sukses!";

  data[remoteJid].remove = cleanTxt;
  await writeJsonFile(data);
}

async function setPromote(remoteJid, text) {
  const data = await readJsonFile();
  if (!data[remoteJid]) {
    data[remoteJid] = {};
  }
  const cleanTxt = text
    ? cleanText(text)
    : "Selamat! Anda telah dipromosikan menjadi admin.";
  data[remoteJid].promote = cleanTxt;
  await writeJsonFile(data);
}

async function setDemote(remoteJid, text) {
  const data = await readJsonFile();
  if (!data[remoteJid]) {
    data[remoteJid] = {};
  }
  const cleanTxt = text
    ? cleanText(text)
    : "Maaf, Anda telah diturunkan dari admin.";
  data[remoteJid].demote = cleanTxt;
  await writeJsonFile(data);
}

async function setTemplateList(remoteJid, text) {
  const data = await readJsonFile();
  if (!data[remoteJid]) {
    data[remoteJid] = {};
  }
  data[remoteJid].templatelist = text || "1";
  await writeJsonFile(data);
}

async function setList(remoteJid, text) {
  const data = await readJsonFile();
  if (!data[remoteJid]) {
    data[remoteJid] = {};
  }
  const cleanTxt = text
    ? cleanText(text)
    : "Template list default dari set list";

  data[remoteJid].setlist = cleanTxt;
  await writeJsonFile(data);
}

async function setDone(remoteJid, text) {
  const data = await readJsonFile();
  if (!data[remoteJid]) {
    data[remoteJid] = {};
  }
  const cleanTxt = text ? cleanText(text) : "Template Done default";
  data[remoteJid].setdone = cleanTxt;
  await writeJsonFile(data);
}

async function setProses(remoteJid, text) {
  const data = await readJsonFile();
  if (!data[remoteJid]) {
    data[remoteJid] = {};
  }
  const cleanTxt = text ? cleanText(text) : "Template Done default";
  data[remoteJid].setproses = cleanTxt;
  await writeJsonFile(data);
}

async function setTemplateWelcome(remoteJid, text) {
  const data = await readJsonFile();
  if (!data[remoteJid]) {
    data[remoteJid] = {};
  }
  data[remoteJid].templatewelcome = text || "1";
  await writeJsonFile(data);
}

// Fungsi generik untuk mengatur jadwal grup
async function setGroupSchedule(sock, remoteJid, text, property) {
  const data = await readJsonFile();
  if (!data[remoteJid]) {
    data[remoteJid] = {};
  }

  if (text.toLowerCase() === "off") {
    if (data[remoteJid][property]) {
      delete data[remoteJid][property]; // Hapus properti
    } else {
      console.log(`${property} tidak ditemukan untuk grup ${remoteJid}.`);
    }
  } else {
    // Simpan waktu dalam UTC
    data[remoteJid][property] = text;
  }

  await writeJsonFile(data);
  updateSocket(sock);
}

async function checkMessage(remoteJid, type) {
  // Membaca data dari file JSON
  const data = await readJsonFile();
  if (!data || typeof data !== "object") {
    throw new Error("Data tidak valid atau gagal dibaca dari file.");
  }

  // Memastikan remoteJid ada dalam data
  if (!data[remoteJid]) {
    return false; // Jika tidak ada, langsung kembalikan false
  }

  // Tipe pesan yang didukung
  const messageTypes = {
    add: "add",
    remove: "remove",
    promote: "promote",
    demote: "demote",
    templatelist: "templatelist",
    templatewelcome: "templatewelcome",
    jadwalsholat: "jadwalsholat",
    setlist: "setlist",
    setdone: "setdone",
    setproses: "setproses",
  };

  // Memetakan tipe ke kunci dalam data
  const messageKey = messageTypes[type];
  if (!messageKey) {
    throw new Error(
      `Tipe yang diberikan tidak valid. Tipe yang didukung: ${Object.keys(
        messageTypes
      ).join(", ")}`
    );
  }
  const messageData = data[remoteJid][messageKey];

  return messageData || false;
}

async function deleteMessage(remoteJid, type) {
  const data = await readJsonFile();
  if (!data || typeof data !== "object" || !data[remoteJid]) {
    return false;
  }

  const messageTypes = {
    add: "add",
    remove: "remove",
    promote: "promote",
    demote: "demote",
    templatelist: "templatelist",
    templatewelcome: "templatewelcome",
    jadwalsholat: "jadwalsholat",
    setlist: "setlist",
    setdone: "setdone",
    setproses: "setproses",
  };

  const messageKey = messageTypes[type];
  if (!messageKey || !data[remoteJid][messageKey]) {
    return false;
  }

  delete data[remoteJid][messageKey];

  // Jika tidak ada lagi kunci dalam objek remoteJid, hapus remoteJid dari data
  if (Object.keys(data[remoteJid]).length === 0) {
    delete data[remoteJid];
  }

  await writeJsonFile(data);
  return true;
}

export {
  setTemplateList,
  setList,
  setDone,
  setProses,
  deleteMessage,
  setTemplateWelcome,
  setWelcome,
  setLeft,
  setPromote,
  setDemote,
  setGroupSchedule,
  checkMessage,
};
