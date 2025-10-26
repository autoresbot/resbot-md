import fs from "fs/promises"; // ESM style import
const path = "./database/group.json"; // Lokasi file JSON

const AUTOSAVE = 30; // 60 Detik

let db = {};

async function loadGroup() {
  try {
    if (!(await fileExists(path))) {
      await fs.writeFile(path, JSON.stringify({}, null, 2), "utf8");
    }
    const data = await fs.readFile(path, "utf8");
    db = JSON.parse(data);
  } catch (error) {
    console.error("❌ Error loading users file:", error);
    db = {};
  }
}

async function readGroup() {
  return db;
}

// ✅ Fungsi baru untuk replace dan simpan data
async function replaceGroup(newData) {
  try {
    db = newData;
    await fs.writeFile(path, JSON.stringify(db, null, 2), "utf8");
  } catch (error) {
    console.error("❌ Error replacing group data:", error);
  }
}

async function resetGroup() {
  try {
    db = {};
    await fs.writeFile(path, JSON.stringify(db, null, 2), "utf8");
  } catch (error) {
    console.error("❌ Gagal me-reset database:", error);
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function saveGroup() {
  try {
    await fs.writeFile(path, JSON.stringify(db, null, 2), "utf8");
  } catch (error) {
    console.error("❌ Error saving users file:", error);
  }
}

async function addGroup(id, userData) {
  try {
    if (db[id]) return false;

    db[id] = {
      ...userData,
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

    // Jika grup sudah memiliki data, pastikan userBlock adalah array
    if (!Array.isArray(db[id].fiturBlock)) {
      db[id].fiturBlock = [];
    }

    // Menambahkan sender ke userBlock jika belum ada
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

    // Pastikan userBlock adalah array sebelum mengecek
    if (!Array.isArray(db[id].fiturBlock)) {
      return false;
    }

    // Mengecek apakah sender ada di userBlock
    return db[id].fiturBlock.includes(command);
  } catch (error) {
    console.error("Error checking fiturBlock:", error);
    return false;
  }
}

async function removeFiturFromBlock(id, command) {
  try {
    if (!db[id]) return false;

    // Pastikan userBlock adalah array sebelum mencoba menghapus
    if (!Array.isArray(db[id].fiturBlock)) {
      return false;
    }

    // Cari index sender di userBlock
    const userIndex = db[id].fiturBlock.indexOf(command);
    if (userIndex === -1) {
      return false;
    }

    // Hapus user dari userBlock
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
          fitur: {
            antilink: false,
            antilinkv2: false,
            antilinkwa: false,
            antilinkwav2: false,
            badword: false,
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
            waktusholat: false,
            antibot: false,
            antitagsw: false,
            antitagsw2: false,
            antitagmeta: false,
            antitagmeta2: false,
          },
          userBlock: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      return db[id];
    }
    // Jika grup belum ada di db dan bukan 'owner', tambahkan data default
    if (!db[id] && id !== "owner") {
      db[id] = {
        fitur: {
          antilink: false,
          antilinkv2: false,
          antilinkwa: false,
          antilinkwav2: false,
          badword: false,
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
          waktusholat: false,
          antibot: false,
          antitagsw: false,
          antitagsw2: false,
          antitagmeta: false,
          antitagmeta2: false,
        },
        userBlock: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // Jika tetap tidak ada dan id adalah 'owner', return null
    if (!db[id] && id === "owner") {
      return null;
    }

    // Return grup data yang pasti ada
    return db[id];
  } catch (error) {
    console.error("Error finding group:", error);
    return null;
  }
}

// Save database setiap 1 menit
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
};
