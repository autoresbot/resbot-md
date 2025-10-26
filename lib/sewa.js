import fs from "fs/promises"; // fs.promises untuk operasi asinkron
const path = "./database/sewa.json"; // Lokasi file JSON
import {
  getCache,
  setCache,
  deleteCache,
  entriesCache,
  sizeCache,
} from "./globalCache.js";
import { logWithTime } from "./utils.js";

// Membaca data dari file JSON
async function readSewa() {
  try {
    let currentSewa;
    const cachedData = getCache(`sewa-group`);
    if (cachedData) {
      currentSewa = cachedData.data; // Menggunakan data dari cache
    } else {
      if (!(await fileExists(path))) {
        await fs.writeFile(path, JSON.stringify({}, null, 2), "utf8"); // Buat file jika belum ada
      }
      const data = await fs.readFile(path, "utf8");
      currentSewa = JSON.parse(data);
      setCache(`sewa-group`, currentSewa);
    }
    return currentSewa;
  } catch (error) {
    console.error("Error reading group file:", error);
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
async function saveSewa(data) {
  try {
    await fs.writeFile(path, JSON.stringify(data, null, 2), "utf8");
    deleteCache(`sewa-group`); // reset cache
    logWithTime("cache sewa-group", `BERHASIL DI HAPUS`, "merah");
  } catch (error) {
    console.error("Error saving group file:", error);
    throw error;
  }
}

// Menambahkan grup baru
async function addSewa(id, userData) {
  try {
    const groups = await readSewa();

    if (groups[id]) {
      // Jika grup sudah ada, lakukan update
      groups[id] = {
        ...groups[id], // Pertahankan data lama
        ...userData, // Update dengan data baru
        updatedAt: new Date().toISOString(), // Perbarui timestamp
      };
    } else {
      // Jika grup belum ada, tambahkan baru
      groups[id] = {
        ...userData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    await saveSewa(groups); // Simpan perubahan
    return true;
  } catch (error) {
    console.error("Error adding or updating group:", error);
    return false;
  }
}

// Memperbarui data grup
async function updateSewa(id, updateData) {
  try {
    const groups = await readSewa();
    if (!groups[id]) {
      return false;
    }

    // Memperbarui data grup dengan fitur yang sudah digabung
    groups[id] = {
      ...groups[id],
      updatedAt: new Date().toISOString(),
    };

    await saveSewa(groups);
    return true;
  } catch (error) {
    console.error("Error updating group:", error);
    return false;
  }
}

// Menghapus grup
async function deleteSewa(id) {
  try {
    const groups = await readSewa();
    if (!groups[id]) {
      return false;
    }
    delete groups[id];
    await saveSewa(groups);
    return true;
  } catch (error) {
    console.error("Error deleting group:", error);
    return false;
  }
}

// Mencari grup berdasarkan ID
async function findSewa(id) {
  try {
    const groups = await readSewa();
    return groups[id] || null;
  } catch (error) {
    console.error("Error finding group:", error);
    return null;
  }
}

async function listSewa(id) {
  try {
    const groups = await readSewa();
    return groups || null;
  } catch (error) {
    console.error("Error finding group:", error);
    return null;
  }
}

export { saveSewa, addSewa, updateSewa, deleteSewa, findSewa, listSewa };
