import fs from "fs/promises"; // fs.promises sudah built-in
import path from "path";
import {
  getCache,
  setCache,
  deleteCache,
  entriesCache,
  sizeCache,
} from "./globalCache.js";
import { logWithTime } from "./utils.js";

const filePath = path.join(
  new URL(".", import.meta.url).pathname,
  "../database",
  "badword.json"
);

// Membaca data dari file JSON
async function readBadword() {
  try {
    let dataBadword;
    const cachedData = getCache(`global-badword`);
    if (cachedData) {
      dataBadword = cachedData.data; // Menggunakan data dari cache
    } else {
      if (!(await fileExists(filePath))) {
        await fs.writeFile(filePath, JSON.stringify({}, null, 2), "utf8");
      }
      const data = await fs.readFile(filePath, "utf8");
      dataBadword = JSON.parse(data);
      setCache(`global-badword`, dataBadword);
    }
    return dataBadword;
  } catch (error) {
    throw error;
  }
}

// Mengecek apakah file ada
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Menyimpan data ke file JSON
async function saveBadword(data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
    deleteCache(`global-badword`); // reset cache
    logWithTime("DELETE CACHE FILE 1", `badword.json`, "merah");
  } catch (error) {
    throw error;
  }
}

// Menambahkan data badword
async function addBadword(id, userData) {
  try {
    const badwords = await readBadword();
    if (badwords[id]) {
      return false;
    }
    badwords[id] = {
      ...userData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveBadword(badwords);
    return true;
  } catch (error) {
    return false;
  }
}

// Memperbarui data badword
async function updateBadword(id, updateData) {
  try {
    const badwords = await readBadword();
    if (!badwords[id]) {
      return false;
    }
    badwords[id] = {
      ...badwords[id], // Menjaga properti sebelumnya
      ...updateData,
      updatedAt: new Date().toISOString(),
    };
    await saveBadword(badwords);
    return true;
  } catch (error) {
    return false;
  }
}

// Menghapus data badword
async function deleteBadword(id) {
  try {
    const badwords = await readBadword();
    if (!badwords[id]) {
      return false;
    }
    delete badwords[id];
    await saveBadword(badwords);
    return true;
  } catch (error) {
    return false;
  }
}

// Mencari data badword berdasarkan ID
async function findBadword(id) {
  try {
    const badwords = await readBadword();
    return badwords[id] || null;
  } catch (error) {
    return null;
  }
}

async function containsBadword(groupId, text) {
  try {
    const badwordData = await readBadword();

    // Pastikan data untuk groupId tersedia
    if (
      !badwordData[groupId] ||
      !Array.isArray(badwordData[groupId].listBadword)
    ) {
      return { status: false, words: "" }; // Tidak ada badword untuk grup ini
    }

    // Ambil daftar badword untuk groupId
    const listBadword = badwordData[groupId].listBadword;

    // Deteksi kata-kata badword dalam teks
    const detectedWords = listBadword.filter((badword) =>
      text.toLowerCase().includes(badword.toLowerCase())
    );

    return {
      status: detectedWords.length > 0,
      words: detectedWords.join(","), // Ubah array jadi string koma
    };
  } catch (error) {
    console.error("Error checking badword:", error);
    return { status: false, words: "" };
  }
}
export {
  readBadword,
  saveBadword,
  addBadword,
  updateBadword,
  deleteBadword,
  findBadword,
  containsBadword,
};
