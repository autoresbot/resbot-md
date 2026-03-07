import fs from "fs/promises"; // ESM style import
const path = "./database/group.json"; // Lokasi file JSON
const backupPath = "./database/group_backup.json"; // Lokasi file backup

const AUTOSAVE = 60; // 60 Detik (diperlambat dari 30 untuk kurangi race condition)

let db = {};
let isSaving = false; // Lock untuk mencegah save bersamaan
let savingQueue = Promise.resolve(); // Queue untuk penyimpanan aman

// =========================================================
// Daftar fitur default yang lengkap dan sinkron
// Semua file (on.js, off.js, usersHandle.js, handler.js)
// harus merujuk ke daftar ini
// =========================================================
const DEFAULT_FITUR = {
  antilink: false,
  antilinkv2: false,
  antilinkwa: false,
  antilinkwav2: false,
  antilinkch: false,
  antilinkchv2: false,
  badword: false,
  badwordv2: false,
  badwordv3: false,
  antidelete: false,
  antiedit: false,
  antigame: false,
  antifoto: false,
  antivideo: false,
  antiaudio: false,
  antidocument: false,
  antikontak: false,
  antisticker: false,
  antipolling: false,
  antispamchat: false,
  antivirtex: false,
  antiviewonce: false,
  autoai: false,
  autosimi: false,
  autorusuh: false,
  welcome: false,
  left: false,
  promote: false,
  demote: false,
  onlyadmin: false,
  mute: false,
  detectblacklist: false,
  detectblacklist2: false,
  waktusholat: false,
  antibot: false,
  antitagsw: false,
  antitagsw2: false,
  antitagmeta: false,
  antitagmeta2: false,
  antiforward: false,
  antiforward2: false,
  antihidetag: false,
  antihidetag2: false,
  notifultah: false,
};

// =========================================================
// Fungsi untuk memastikan fitur lengkap (migrasi otomatis)
// Jika ada fitur baru yang belum ada di data lama,
// otomatis ditambahkan dengan value false (tanpa mereset yg lama)
// =========================================================
function ensureAllFeatures(fitur) {
  if (!fitur || typeof fitur !== "object") {
    return { ...DEFAULT_FITUR };
  }
  // Gabungkan: default dulu, lalu timpa dengan data yang sudah ada
  // Ini memastikan fitur baru ditambahkan tanpa menghapus yg lama
  return { ...DEFAULT_FITUR, ...fitur };
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// =========================================================
// Backup: Simpan salinan data sebelum operasi berbahaya
// =========================================================
async function createBackup() {
  try {
    if (Object.keys(db).length > 0) {
      await fs.writeFile(backupPath, JSON.stringify(db, null, 2), "utf8");
    }
  } catch (error) {
    console.error("❌ Error creating group backup:", error);
  }
}

async function loadFromBackup() {
  try {
    if (await fileExists(backupPath)) {
      const data = await fs.readFile(backupPath, "utf8");
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
        console.log("🔄 Memuat data grup dari backup...");
        return parsed;
      }
    }
  } catch (error) {
    console.error("❌ Error loading backup:", error);
  }
  return null;
}

// =========================================================
// Load: Baca database dari file dengan proteksi
// =========================================================
async function loadGroup() {
  try {
    if (!(await fileExists(path))) {
      await fs.writeFile(path, JSON.stringify({}, null, 2), "utf8");
    }
    const data = await fs.readFile(path, "utf8");

    // Validasi bahwa data adalah JSON yang valid
    if (!data || data.trim() === "") {
      console.error("⚠️ group.json kosong, mencoba backup...");
      const backupData = await loadFromBackup();
      if (backupData) {
        db = backupData;
        // Langsung simpan backup ke file utama
        await fs.writeFile(path, JSON.stringify(db, null, 2), "utf8");
        console.log("✅ Data grup berhasil dipulihkan dari backup");
      } else {
        console.log("⚠️ Tidak ada backup tersedia, memulai dengan database kosong");
        db = {};
      }
      return;
    }

    const parsed = JSON.parse(data);

    // Validasi bahwa data adalah object
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Format group.json tidak valid (bukan object)");
    }

    db = parsed;

    // Buat backup setelah berhasil load
    await createBackup();

    console.log(`[✔] Group database loaded (${Object.keys(db).length} groups)`);
  } catch (error) {
    console.error("❌ Error loading group file:", error.message);

    // =====================================================
    // FIX KRITIS: Jangan reset db ke {}!!!
    // Coba pulihkan dari backup terlebih dahulu
    // =====================================================
    const backupData = await loadFromBackup();
    if (backupData) {
      db = backupData;
      console.log("✅ Data grup berhasil dipulihkan dari backup setelah error");
      // Perbaiki file utama
      try {
        await fs.writeFile(path, JSON.stringify(db, null, 2), "utf8");
      } catch (e) {
        console.error("❌ Gagal memperbaiki file utama:", e);
      }
    } else if (Object.keys(db).length > 0) {
      // Pertahankan data yang sudah ada di memori jika ada
      console.log("⚠️ Menggunakan data grup yang sudah ada di memori");
    } else {
      console.log("⚠️ Tidak ada data tersedia, memulai dengan database kosong");
      db = {};
    }
  }
}

async function readGroup() {
  return db;
}

// =========================================================
// Save: Dengan queue untuk mencegah race condition
// (Mengikuti pola dari users.js)
// =========================================================
async function saveGroup() {
  savingQueue = savingQueue.then(async () => {
    try {
      // Jangan simpan jika db kosong tapi file punya data
      if (Object.keys(db).length === 0) {
        // Double check: jika file punya data, jangan timpa dengan kosong
        try {
          if (await fileExists(path)) {
            const existingData = await fs.readFile(path, "utf8");
            const existingParsed = JSON.parse(existingData);
            if (Object.keys(existingParsed).length > 0) {
              console.log("⚠️ Mencegah penimpaan data: db kosong tapi file punya data, skip save");
              // Pulihkan data dari file
              db = existingParsed;
              return;
            }
          }
        } catch (e) {
          // File mungkin corrupt, lanjutkan save
        }
      }

      // Buat backup sebelum save
      await createBackup();

      await fs.writeFile(path, JSON.stringify(db, null, 2), "utf8");
    } catch (error) {
      console.error("❌ Error saving group file:", error);
    }
  });
  return savingQueue;
}

// ✅ Fungsi baru untuk replace dan simpan data
async function replaceGroup(newData) {
  try {
    // Buat backup sebelum replace
    await createBackup();

    db = newData;
    await fs.writeFile(path, JSON.stringify(db, null, 2), "utf8");
  } catch (error) {
    console.error("❌ Error replacing group data:", error);
  }
}

async function resetGroup() {
  try {
    // Buat backup sebelum reset
    await createBackup();

    db = {};
    await fs.writeFile(path, JSON.stringify(db, null, 2), "utf8");
    console.log("🔄 Database grup telah di-reset (backup tersedia)");
  } catch (error) {
    console.error("❌ Gagal me-reset database:", error);
  }
}

async function addGroup(id, userData) {
  try {
    if (db[id]) return false;

    db[id] = {
      ...userData,
      // Pastikan fitur lengkap saat menambah grup baru
      fitur: ensureAllFeatures(userData.fitur),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return true;
  } catch (error) {
    console.error("Error adding group:", error);
    return false;
  }
}

async function updateGroup(id, updateData) {
  try {
    if (!db[id]) return false;

    // Menggabungkan fitur lama dan fitur baru
    const updatedFeatures = {
      ...db[id].fitur, // fitur yang sudah ada
      ...updateData.fitur, // fitur yang akan diupdate
    };

    // Memperbarui data grup dengan fitur yang sudah digabung
    db[id] = {
      ...db[id],
      fitur: updatedFeatures, // Tetap mempertahankan fitur lama dan menambahkan yang baru
      updatedAt: new Date().toISOString(),
    };
    return true;
  } catch (error) {
    console.error("Error updating group:", error);
    return false;
  }
}

// User Block
async function addUserBlock(id, sender) {
  try {
    if (!db[id]) return false;

    // Jika grup sudah memiliki data, pastikan userBlock adalah array
    if (!Array.isArray(db[id].userBlock)) {
      db[id].userBlock = [];
    }

    // Menambahkan sender ke userBlock jika belum ada
    if (!db[id].userBlock.includes(sender)) {
      db[id].userBlock.push(sender);
    }
    // Perbarui timestamp
    db[id].updatedAt = new Date().toISOString();
    return true;
  } catch (error) {
    console.error("Error updating group:", error);
    return false;
  }
}

async function isUserBlocked(id, sender) {
  try {
    if (!db[id]) return false;

    // Pastikan userBlock adalah array sebelum mengecek
    if (!Array.isArray(db[id].userBlock)) {
      return false;
    }

    // Mengecek apakah sender ada di userBlock
    return db[id].userBlock.includes(sender);
  } catch (error) {
    console.error("Error checking userBlock:", error);
    return false;
  }
}

async function removeUserFromBlock(id, sender) {
  try {
    if (!db[id]) return false;

    // Pastikan userBlock adalah array sebelum mencoba menghapus
    if (!Array.isArray(db[id].userBlock)) {
      return false;
    }

    // Cari index sender di userBlock
    const userIndex = db[id].userBlock.indexOf(sender);
    if (userIndex === -1) {
      return false;
    }

    // Hapus user dari userBlock
    db[id].userBlock.splice(userIndex, 1);

    return true;
  } catch (error) {
    return false;
  }
}

// Fitur block
async function addFiturBlock(id, command) {
  try {
    if (!db[id]) return false;

    // Jika grup sudah memiliki data, pastikan fiturBlock adalah array
    if (!Array.isArray(db[id].fiturBlock)) {
      db[id].fiturBlock = [];
    }

    // Menambahkan command ke fiturBlock jika belum ada
    if (!db[id].fiturBlock.includes(command)) {
      db[id].fiturBlock.push(command);
    }

    // Perbarui timestamp
    db[id].updatedAt = new Date().toISOString();
    return true;
  } catch (error) {
    console.error("Error updating group:", error);
    return false;
  }
}

async function isFiturBlocked(id, command) {
  try {
    if (!db[id]) return false;

    // Pastikan fiturBlock adalah array sebelum mengecek
    if (!Array.isArray(db[id].fiturBlock)) {
      return false;
    }

    // Mengecek apakah command ada di fiturBlock
    return db[id].fiturBlock.includes(command);
  } catch (error) {
    console.error("Error checking fiturBlock:", error);
    return false;
  }
}

async function removeFiturFromBlock(id, command) {
  try {
    if (!db[id]) return false;

    // Pastikan fiturBlock adalah array sebelum mencoba menghapus
    if (!Array.isArray(db[id].fiturBlock)) {
      return false;
    }

    // Cari index command di fiturBlock
    const userIndex = db[id].fiturBlock.indexOf(command);
    if (userIndex === -1) {
      return false;
    }

    // Hapus fitur dari fiturBlock
    db[id].fiturBlock.splice(userIndex, 1);

    return true;
  } catch (error) {
    return false;
  }
}

async function getUserBlockList(id) {
  try {
    if (!db[id]) return false;

    // Pastikan userBlock adalah array
    if (!Array.isArray(db[id].userBlock)) {
      return [];
    }

    // Kembalikan daftar userBlock
    return db[id].userBlock;
  } catch (error) {
    console.error("Error fetching userBlock list:", error);
    return [];
  }
}

async function deleteGroup(id) {
  try {
    if (!db[id]) return false;
    delete db[id];
    return true;
  } catch (error) {
    console.error("Error deleting group:", error);
    return false;
  }
}

async function findGroup(id, search = false) {
  try {
    if (search && id == "owner") {
      if (!db[id]) {
        db[id] = {
          fitur: { ...DEFAULT_FITUR },
          userBlock: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      } else {
        // Migrasi: pastikan fitur lengkap tanpa reset yg lama
        db[id].fitur = ensureAllFeatures(db[id].fitur);
      }

      return db[id];
    }

    // Jika grup belum ada di db dan bukan 'owner', tambahkan data default
    if (!db[id] && id !== "owner") {
      db[id] = {
        fitur: { ...DEFAULT_FITUR },
        userBlock: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // Jika tetap tidak ada dan id adalah 'owner', return null
    if (!db[id] && id === "owner") {
      return null;
    }

    // Migrasi: pastikan fitur lengkap tanpa reset yg lama
    db[id].fitur = ensureAllFeatures(db[id].fitur);

    // Return grup data yang pasti ada
    return db[id];
  } catch (error) {
    console.error("Error finding group:", error);
    return null;
  }
}

// Save database setiap AUTOSAVE detik
setInterval(saveGroup, AUTOSAVE * 1000);

// Load data pertama kali
loadGroup();

// Named export semua fungsi
export {
  readGroup,
  saveGroup,
  addGroup,
  updateGroup,
  deleteGroup,
  findGroup,
  addUserBlock,
  isUserBlocked,
  removeUserFromBlock,
  getUserBlockList,
  addFiturBlock,
  isFiturBlocked,
  removeFiturFromBlock,
  resetGroup,
  replaceGroup,
  DEFAULT_FITUR,
  ensureAllFeatures,
};
