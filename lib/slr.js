import fs from "fs/promises";
import path from "path";
import {
  getCache,
  setCache,
  deleteCache,
  entriesCache,
  sizeCache,
} from "./globalCache.js";

const pathFile = "../database/slr.json";

// Mengecek apakah file ada
export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function addSlr(id_grup, status, message) {
  try {
    let data = {};
    try {
      const fileContent = await fs.readFile(pathFile, "utf-8");
      data = JSON.parse(fileContent);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
    data[id_grup] = { status, message };

    await fs.writeFile(pathFile, JSON.stringify(data, null, 2), "utf-8");
    deleteCache(`slr-group-${id_grup}`);
  } catch (error) {
    console.error("Terjadi kesalahan saat menyimpan data:", error);
  }
}

async function SLRcheckMessage(id_grup) {
  try {
    let currentSLR;
    const cachedData = getCache(`slr-group-${id_grup}`);
    if (cachedData) {
      currentSLR = cachedData.data; // Menggunakan data dari cache
    } else {
      if (!(await fileExists(pathFile))) {
        await fs.writeFile(pathFile, JSON.stringify({}, null, 2), "utf8"); // Buat file jika belum ada
      }
      const fileContent = await fs.readFile(pathFile, "utf-8");
      const data = JSON.parse(fileContent);

      if (data[id_grup] && data[id_grup].status === true) {
        currentSLR = data[id_grup].message;
        setCache(`slr-group-${id_grup}`, currentSLR);
      }
      return null;
    }
    return currentSLR;
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Terjadi kesalahan saat membaca data:", error);
    }
    return null;
  }
}

export { addSlr, SLRcheckMessage };
