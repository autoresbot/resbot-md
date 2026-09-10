import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Mendapatkan __dirname di ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Membaca file sebagai buffer
 * @param {string} filePath - Path relatif atau absolute file
 * @returns {Buffer}
 */
const readFileAsBuffer = (filePath) => {
  // Jika path dimulai dengan alias @assets, ganti dengan folder assets
  if (filePath.startsWith("@assets/")) {
    const relativePath = filePath.replace("@assets/", "");
    filePath = path.join(__dirname, "../database/assets", relativePath);
  } else if (!path.isAbsolute(filePath)) {
    // Untuk path relatif, gabungkan dengan __dirname
    filePath = path.join(__dirname, filePath);
  }

  // Cek apakah file ada
  if (!fs.existsSync(filePath)) {
    throw new Error(`File "${filePath}" tidak ditemukan!`);
  }

  // Membaca file sebagai buffer
  return fs.readFileSync(filePath);
};

export { readFileAsBuffer };
