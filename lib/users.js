import config from "../config.js";
import { promises as fsp } from "fs";

const usersJson = "./database/users.json";
const ownerJson = "./database/owner.json";

let savingQueueUsers = Promise.resolve(); // Queue untuk penyimpanan users
let savingQueueOwners = Promise.resolve(); // Queue untuk penyimpanan owners

const AUTOSAVE = 5; // 60 Detik

const MS_IN_A_DAY = 24 * 60 * 60 * 1000; // Konstanta untuk 1 hari dalam milidetik

let db = {}; // Database pengguna di memori
let dbOwner = []; // Database owner di memori

// Mengecek apakah file ada
async function fileExists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Load users.json ke dalam memori
async function loadUsers() {
  try {
    if (!(await fileExists(usersJson))) {
      await fsp.writeFile(usersJson, JSON.stringify({}, null, 2), "utf8");
    }

    const data = await fsp.readFile(usersJson, "utf8");
    db = JSON.parse(data);
  } catch (error) {
    console.error("❌ Error loading users file:", error);
    db = {};
  }
}

async function resetMoney() {
  for (const userId in db) {
    if (db.hasOwnProperty(userId)) {
      db[userId].money = 0;
      db[userId].updatedAt = new Date().toISOString();
    }
  }
}

function resetMemberOld() {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let deletedCount = 0;

  for (const userId in db) {
    if (!db.hasOwnProperty(userId)) continue;

    const user = db[userId];
    const lastUpdate = new Date(user.updatedAt).getTime();

    if (now - lastUpdate > THIRTY_DAYS_MS) {
      delete db[userId];
      deletedCount++;
    }
  }
}

async function resetLimit() {
  for (const userId in db) {
    if (db.hasOwnProperty(userId)) {
      db[userId].limit = 0;
      db[userId].updatedAt = new Date().toISOString();
    }
  }
}

async function resetLevel() {
  for (const userId in db) {
    if (db.hasOwnProperty(userId)) {
      db[userId].level = 0;
      db[userId].updatedAt = new Date().toISOString();
    }
  }
}

async function resetUsers() {
  db = {}; // Reset database di memori
  await saveUsers();
}

async function resetOwners() {
  dbOwner = []; // Reset database owner di memori
  await saveOwners();
}

// Load owner.json ke dalam memori
async function loadOwners() {
  try {
    if (!(await fileExists(ownerJson))) {
      await fsp.writeFile(ownerJson, JSON.stringify([], null, 2), "utf8");
    }

    const data = await fsp.readFile(ownerJson, "utf8");
    dbOwner = JSON.parse(data);

    if (!Array.isArray(dbOwner)) {
      throw new Error("Format owner.json tidak sesuai (harus berupa array).");
    }
  } catch (error) {
    console.error("❌ Error loading owner file:", error);
    dbOwner = [];
  }
}

// Fungsi menyimpan database users dari memori ke file
async function saveUsers() {
  savingQueueUsers = savingQueueUsers.then(async () => {
    try {
      await fsp.writeFile(usersJson, JSON.stringify(db, null, 2), "utf8");
    } catch (error) {
      console.error("❌ Error saving users file:", error);
    }
  });
}

// Fungsi menyimpan database owners dari memori ke file
async function saveOwners() {
  savingQueueOwners = savingQueueOwners.then(async () => {
    try {
      await fsp.writeFile(ownerJson, JSON.stringify(dbOwner, null, 2), "utf8");
    } catch (error) {
      console.error("❌ Error saving owners file:", error);
    }
  });
}

// Fungsi membaca users dari memori
async function readUsers() {
  return db;
}

function generateUUID() {
  return (
    "xxxxxxxxyxxxxyxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    }) + Date.now().toString(16)
  );
}

// Fungsi menambahkan user ke memori
function addUser(id, userData) {
  if (db[id]) return false;

  db[id] = {
    aliases: [id], // <- ini array yg nampung jid pertama
    ...userData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return true;
}

function isUserRegistered(jid) {
  return Object.values(db || {}).some(
    (user) => Array.isArray(user?.aliases) && user.aliases.includes(jid)
  );
}

function findUserByAnyId(jid) {
  return Object.entries(db || {}).find(
    ([id, user]) => Array.isArray(user?.aliases) && user.aliases.includes(jid)
  );
}

function findUserByUsername(username) {
  const uname = username.toLowerCase();
  return Object.entries(db).find(([id, user]) => user.username === uname);
}

function registerUser(jid, username) {
  const uname = username.toLowerCase();

  const userByUsername = findUserByUsername(uname); // [userId, user] atau undefined
  const userByJid = findUserByAnyId(jid); // [userId, user] atau undefined

  // 🧩 CASE 1: Username belum ada di DB
  if (!userByUsername) {
    if (!userByJid) {
      // ✅ Username belum ada, JID belum ada → register baru
      const userId = generateUUID();
      db[userId] = {
        username: uname,
        aliases: [jid],
        money: 0,
        limit: 0,
        level_cache: 0,
        level: 1,
        role: "user",
        achievement: "gamers",
        status: "active",
        afk: { lastchat: 0, alasan: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return userId;
    } else {
      // ✅ Username belum ada, JID sudah ada → user ini sudah register, update username?
      // tergantung logika: disini biasanya return "registered"
      return "registered";
    }
  }

  // 🧩 CASE 2: Username sudah ada → harus cek: user yg sama atau beda
  const [usernameUserId, usernameUser] = userByUsername;

  if (userByJid) {
    const [jidUserId, jidUser] = userByJid;

    if (jidUserId === usernameUserId) {
      // ✅ Ini user yang sama → user sudah terdaftar
      return "registered";
    } else {
      // ❌ Ini user berbeda → username sudah dipakai user lain
      return "taken";
    }
  } else {
    // JID belum ada di mana pun → apakah bisa join ke user ini?
    // Cek apakah userByUsername sudah punya alias tipe sama
    const isLid = jid.endsWith("@lid");
    const isWa = jid.endsWith("@s.whatsapp.net");

    const hasSameType = usernameUser.aliases.some(
      (existing) =>
        (isLid && existing.endsWith("@lid")) ||
        (isWa && existing.endsWith("@s.whatsapp.net"))
    );

    if (!hasSameType) {
      // ✅ Tambahkan alias baru, user sama
      usernameUser.aliases.push(jid);
      usernameUser.updatedAt = new Date().toISOString();
      return "registered";
    } else {
      // ❌ Sudah punya alias tipe sama → tidak boleh, username dipakai user lain
      return "taken";
    }
  }
}

function updateUser(id, updateData) {
  const cariData = findUser(id);
  if (!cariData) return false;

  const [docId, oldData] = cariData;

  if (updateData.money !== undefined) {
    updateData.money = Math.max(0, updateData.money);
  }
  if (updateData.limit !== undefined) {
    updateData.limit = Math.max(0, updateData.limit);
  }

  // Update datanya
  db[docId] = {
    ...oldData,
    ...updateData,
    updatedAt: new Date().toISOString(),
  };

  return true;
}

// Menghapus pengguna
function deleteUser(id) {
  if (!db[id]) return false;
  delete db[id];
  return true;
}

// Cari pengguna berdasarkan username atau nomor telepon (alias)
function findUser(id) {
  if (!id) return null;

  // 1. Coba cari langsung dengan username
  const userByUsername = findUserByUsername(id);
  if (userByUsername) return userByUsername;

  // 2. Ekstrak angka dari id (misal nomor telepon)
  const onlyNumber = id.replace(/\D/g, ""); // ambil semua digit
  if (!onlyNumber) return null;

  // 3. Loop database untuk cek alias yang cocok
  for (const [userId, user] of Object.entries(db)) {
    if (!Array.isArray(user.aliases)) continue;

    const foundAlias = user.aliases.find((alias) => {
      const aliasNumber = alias.replace(/\D/g, "");
      return aliasNumber && aliasNumber === onlyNumber;
    });

    if (foundAlias) {
      return [userId, user]; // kembalikan pasangan ID & data user
    }
  }

  return null; // tidak ketemu
}

// Cek apakah user premium
function isPremiumUser(remoteJid) {
  const dataUsers = findUser(remoteJid);
  if (!dataUsers) return false;

  const [docId, userData] = dataUsers;

  const premiumDate = new Date(userData.premium);
  return !isNaN(premiumDate) && premiumDate > new Date();
}

// Mendapatkan daftar pengguna tidak aktif selama lebih dari 7 hari
function getInactiveUsers() {
  const sevenDaysAgo = Date.now() - 7 * MS_IN_A_DAY;

  return Object.entries(db)
    .filter(([_, userData]) => {
      if (!userData.updatedAt) return false;
      return new Date(userData.updatedAt).getTime() < sevenDaysAgo;
    })
    .map(([id, userData]) => ({ id, updatedAt: userData.updatedAt }));
}

// Mendapatkan daftar pengguna yang masih aktif dalam 7 hari terakhir

function getActiveUsers(TOTAL_HARI_SIDER) {
  const sevenDaysAgo = Date.now() - TOTAL_HARI_SIDER * MS_IN_A_DAY;

  return Object.entries(db)
    .filter(([_, userData]) => {
      if (!userData.updatedAt) return false;
      return new Date(userData.updatedAt).getTime() >= sevenDaysAgo;
    })
    .map(([id, userData]) => ({ id, updatedAt: userData.updatedAt }));
}

function generateAllOwnerIds() {
  try {
    // Pastikan data sumber adalah array, fallback ke []
    const ownerNumbers = Array.isArray(config?.owner_number)
      ? config.owner_number
      : [];
    const dbOwnerNumbers = Array.isArray(dbOwner) ? dbOwner : [];

    // Gabungkan
    const rawIds = [...ownerNumbers, ...dbOwnerNumbers];

    const allIds = new Set();

    for (const raw of rawIds) {
      if (typeof raw !== "string" || !raw.trim()) {
        continue; // Lewati jika bukan string atau kosong
      }

      let base = raw.trim();

      if (base.includes("@")) {
        const parts = base.split("@");
        if (parts[0]) {
          base = parts[0];
        } else {
          continue; // Lewati jika sebelum @ kosong
        }
        allIds.add(raw.trim()); // Tambahkan original
      }

      // Tambahkan dua format standar
      allIds.add(`${base}@s.whatsapp.net`);
      allIds.add(`${base}@lid`);
    }

    return Array.from(allIds);
  } catch (error) {
    console.error("Error in generateAllOwnerIds:", error);
    return []; // Fallback aman
  }
}

function isOwner(remoteJid) {
  const ownerIds = generateAllOwnerIds();
  return ownerIds.includes(remoteJid);
}

// List semua owner
function listOwner() {
  const ownerJids = config.owner_number.map(
    (number) => `${number}@s.whatsapp.net`
  );
  return [...ownerJids, ...dbOwner];
}

// Tambahkan owner baru
function addOwner(number) {
  if (!dbOwner.includes(number)) {
    dbOwner.push(number);
    return true;
  }
  return false;
}

// Hapus owner
function delOwner(number) {
  const index = dbOwner.indexOf(number);
  if (index !== -1) {
    dbOwner.splice(index, 1);
    return true;
  }
  return false;
}

// Save database setiap 1 menit
setInterval(saveUsers, AUTOSAVE * 1000);
setInterval(saveOwners, AUTOSAVE * 1000);

// Load data pertama kali
loadUsers();
loadOwners();

// Ekspor fungsi
export {
  readUsers,
  addUser,
  updateUser,
  deleteUser,
  findUser,
  getInactiveUsers,
  getActiveUsers,
  isPremiumUser,
  isOwner,
  listOwner,
  addOwner,
  delOwner,
  saveUsers,
  saveOwners,
  resetUsers,
  resetOwners,
  resetMoney,
  resetLimit,
  resetLevel,
  resetMemberOld,
  registerUser,
  isUserRegistered,
  db, // Ekspor database jika dibutuhkan di file lain
  dbOwner, // Ekspor database owner jika dibutuhkan
};
