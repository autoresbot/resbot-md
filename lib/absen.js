import fs from "fs/promises"; // fs.promises sudah built-in di Node.js
const ABSEN_FILE_PATH = "./database/additional/absen.json";
import { logWithTime } from "./utils.js";

// Mengecek apakah file ada
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Membaca data dari file JSON
async function readAbsen() {
  try {
    if (!(await fileExists(ABSEN_FILE_PATH))) {
      await fs.writeFile(ABSEN_FILE_PATH, JSON.stringify({}, null, 2), "utf8"); // Buat file jika belum ada
    }
    const data = await fs.readFile(ABSEN_FILE_PATH, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`[readAbsen] Error reading file: ${ABSEN_FILE_PATH}`, error);
    throw error;
  }
}

// Menyimpan data ke file JSON
async function saveAbsen(data) {
  try {
    await fs.writeFile(ABSEN_FILE_PATH, JSON.stringify(data, null, 2), "utf8");
    logWithTime("WRITE FILE", `absen.json`, "merah");
  } catch (error) {
    console.error(`[saveAbsen] Error saving file: ${ABSEN_FILE_PATH}`, error);
    throw error;
  }
}

// Menambahkan grup baru
async function createAbsen(id, userData) {
  const today = new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  try {
    const groups = await readAbsen();
    if (groups[id]) {
      return false;
    }

    groups[id] = {
      ...userData,
      createdAt: today, // Format tanggal konsisten
    };

    await saveAbsen(groups);
    return true;
  } catch (error) {
    console.error(`[createAbsen] Error creating absen with ID "${id}":`, error);
    return false;
  }
}

// Memperbarui data grup
async function updateAbsen(id, updateData) {
  try {
    const groups = await readAbsen();
    if (!groups[id]) {
      return false;
    }

    groups[id] = {
      ...groups[id],
      ...updateData,
      updatedAt: new Date().toISOString(),
    };

    await saveAbsen(groups);
    return true;
  } catch (error) {
    console.error(`[updateAbsen] Error updating absen with ID "${id}":`, error);
    return false;
  }
}

// Menghapus grup
async function deleteAbsen(id) {
  try {
    const groups = await readAbsen();
    if (!groups[id]) {
      return false;
    }

    delete groups[id];
    await saveAbsen(groups);
    return true;
  } catch (error) {
    console.error(`[deleteAbsen] Error deleting absen with ID "${id}":`, error);
    return false;
  }
}

// Mencari grup berdasarkan ID
async function findAbsen(id) {
  const today = new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  try {
    const groups = await readAbsen();

    // Cek apakah data absen tersedia
    const absenData = groups[id];
    if (!absenData) return null;

    if (absenData.createdAt !== today) {
      // Reset data jika hari berganti
      absenData.member = []; // Kosongkan anggota
      absenData.createdAt = today; // Perbarui tanggal

      // Simpan perubahan
      await saveAbsen(groups);
    }

    return absenData;
  } catch (error) {
    console.error(`[findAbsen] Error finding absen with ID "${id}":`, error);
    return null;
  }
}

export {
  readAbsen,
  saveAbsen,
  createAbsen,
  updateAbsen,
  deleteAbsen,
  findAbsen,
};
