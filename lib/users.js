/**
 * users.js - Manajemen User menggunakan SQLite
 *
 * Refactored dari JSON file ke SQLite.
 * Semua fungsi export tetap sama agar backward compatible.
 */

import config from '../config.js';
import { getDb, safeJsonParse, toJson, initDatabase } from './database.js';

// Pastikan database diinisialisasi
initDatabase();

const MS_IN_A_DAY = 24 * 60 * 60 * 1000;

// ==== Prepared Statements (di-cache untuk performa) ====
let stmtCache = {};

function getStmt(key, sql) {
  if (!stmtCache[key]) {
    stmtCache[key] = getDb().prepare(sql);
  }
  return stmtCache[key];
}

// ==== Helper: convert row ke format lama ====
function rowToUser(row) {
  if (!row) return null;
  return {
    username: row.username,
    aliases: safeJsonParse(row.aliases, []),
    money: row.money,
    limit: row.limit_count,
    level_cache: row.level_cache,
    level: row.level,
    role: row.role,
    achievement: row.achievement,
    status: row.status,
    premium: row.premium || undefined,
    afk: safeJsonParse(row.afk, { lastchat: 0, alasan: null }),
    birthday: row.birthday || undefined,
    birthYear: row.birth_year || undefined,
    lastBirthdayWish: row.last_birthday_wish || undefined,
    lastClaim: row.last_claim || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==== CRUD Functions ====

function generateUUID() {
  return (
    'xxxxxxxxyxxxxyxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    }) + Date.now().toString(16)
  );
}

/**
 * Baca semua users - mengembalikan object format lama { id: userData }
 */
async function readUsers() {
  const rows = getStmt('readAll', 'SELECT * FROM users').all();
  const result = {};
  for (const row of rows) {
    result[row.id] = rowToUser(row);
  }
  return result;
}

/**
 * Tambah user baru
 */
function addUser(id, userData) {
  try {
    const existing = getStmt('getById', 'SELECT id FROM users WHERE id = ?').get(id);
    if (existing) return false;

    getStmt(
      'insertUser',
      `
      INSERT INTO users (id, username, aliases, money, limit_count, level_cache, level, role, achievement, status, premium, afk, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      id,
      userData.username || `user_${id}`,
      toJson(userData.aliases || [id]),
      userData.money || 0,
      userData.limit || 0,
      userData.level_cache || 0,
      userData.level || 1,
      userData.role || 'user',
      userData.achievement || 'gamers',
      userData.status || 'active',
      userData.premium || null,
      toJson(userData.afk || { lastchat: 0, alasan: null }),
      new Date().toISOString(),
      new Date().toISOString(),
    );
    return true;
  } catch (error) {
    console.error('❌ Error addUser:', error.message);
    return false;
  }
}

/**
 * Cek apakah user sudah terdaftar (berdasarkan JID di aliases)
 */
function isUserRegistered(jid) {
  const rows = getStmt('allUsers', 'SELECT aliases FROM users').all();
  return rows.some((row) => {
    const aliases = safeJsonParse(row.aliases, []);
    return Array.isArray(aliases) && aliases.includes(jid);
  });
}

/**
 * Cari user berdasarkan JID di aliases
 */
function findUserByAnyId(jid) {
  const rows = getStmt('allUsersFull', 'SELECT * FROM users').all();
  for (const row of rows) {
    const aliases = safeJsonParse(row.aliases, []);
    if (Array.isArray(aliases) && aliases.includes(jid)) {
      return [row.id, rowToUser(row)];
    }
  }
  return undefined;
}

/**
 * Cari user berdasarkan username
 */
function findUserByUsername(username) {
  const uname = username.toLowerCase();
  const row = getStmt('byUsername', 'SELECT * FROM users WHERE username = ?').get(uname);
  if (!row) return undefined;
  return [row.id, rowToUser(row)];
}

/**
 * Register user baru (logic sama persis dengan versi JSON)
 */
function registerUser(jid, username) {
  const uname = username.toLowerCase();

  const userByUsername = findUserByUsername(uname);
  const userByJid = findUserByAnyId(jid);

  // CASE 1: Username belum ada di DB
  if (!userByUsername) {
    if (!userByJid) {
      // Register baru
      const userId = generateUUID();
      getStmt(
        'insertUser',
        `
        INSERT INTO users (id, username, aliases, money, limit_count, level_cache, level, role, achievement, status, premium, afk, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        userId,
        uname,
        toJson([jid]),
        0,
        0,
        0,
        1,
        'user',
        'gamers',
        'active',
        null,
        toJson({ lastchat: 0, alasan: null }),
        new Date().toISOString(),
        new Date().toISOString(),
      );
      return userId;
    } else {
      return 'registered';
    }
  }

  // CASE 2: Username sudah ada
  const [usernameUserId, usernameUser] = userByUsername;

  if (userByJid) {
    const [jidUserId] = userByJid;
    if (jidUserId === usernameUserId) {
      return 'registered';
    } else {
      return 'taken';
    }
  } else {
    const isLid = jid.endsWith('@lid');
    const isWa = jid.endsWith('@s.whatsapp.net');

    const hasSameType = usernameUser.aliases.some(
      (existing) =>
        (isLid && existing.endsWith('@lid')) || (isWa && existing.endsWith('@s.whatsapp.net')),
    );

    if (!hasSameType) {
      // Tambahkan alias baru
      const newAliases = [...usernameUser.aliases, jid];
      getStmt('updateAliases', 'UPDATE users SET aliases = ?, updated_at = ? WHERE id = ?').run(
        toJson(newAliases),
        new Date().toISOString(),
        usernameUserId,
      );
      return 'registered';
    } else {
      return 'taken';
    }
  }
}

/**
 * Update user
 */
function updateUser(id, updateData) {
  const cariData = findUser(id, 'Debug 2');
  if (!cariData) return false;

  const [docId, oldData] = cariData;

  if (updateData.money !== undefined) {
    updateData.money = Math.max(0, updateData.money);
  }
  if (updateData.limit !== undefined) {
    updateData.limit = Math.max(0, updateData.limit);
  }

  const merged = { ...oldData, ...updateData };

  getStmt(
    'updateUser',
    `
    UPDATE users SET 
      username = ?, aliases = ?, money = ?, limit_count = ?,
      level_cache = ?, level = ?, role = ?, achievement = ?,
      status = ?, premium = ?, afk = ?,
      birthday = ?, birth_year = ?, last_birthday_wish = ?,
      last_claim = ?, updated_at = ?
    WHERE id = ?
  `,
  ).run(
    merged.username,
    toJson(merged.aliases || []),
    merged.money || 0,
    merged.limit || 0,
    merged.level_cache || 0,
    merged.level || 1,
    merged.role || 'user',
    merged.achievement || 'gamers',
    merged.status || 'active',
    merged.premium || null,
    toJson(merged.afk || { lastchat: 0, alasan: null }),
    merged.birthday || null,
    merged.birthYear || null,
    merged.lastBirthdayWish || null,
    merged.lastClaim || null,
    new Date().toISOString(),
    docId,
  );

  return true;
}

/**
 * Hapus user
 */
function deleteUser(id) {
  const result = getStmt('deleteUser', 'DELETE FROM users WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Cari user (by username, by JID, atau auto-register)
 */
function findUser(id, options = 'any') {
  // Buat debug log untuk opsi pencarian
  //console.log('options findUser:', id);

  if (!id) return null;

  // 1. Cari by username
  let user = findUserByUsername(id);
  if (user) return user;

  // 2. Cari by nomor HP di aliases
  const onlyNumber = id.replace(/\D/g, '');
  if (onlyNumber) {
    const rows = getStmt('allUsersFull', 'SELECT * FROM users').all();
    for (const row of rows) {
      const aliases = safeJsonParse(row.aliases, []);
      if (!Array.isArray(aliases)) continue;

      const found = aliases.some((alias) => {
        const aliasNumber = alias.replace(/\D/g, '');
        return aliasNumber && aliasNumber === onlyNumber;
      });

      if (found) return [row.id, rowToUser(row)];
    }
  }

  // 3. Auto-register
  try {
    const username = `user_${id.toLowerCase()}`;
    const newUser = registerUser(id, username);

    if (newUser) return newUser;

    user = findUserByUsername(username);
    if (user) return user;
  } catch (error) {
    console.log('GAGAL REGISTER OTOMATIS:', error);
  }

  return null;
}

/**
 * Cek apakah user premium
 */
function isPremiumUser(remoteJid) {
  const dataUsers = findUser(remoteJid, 'debug isPremiumUser');
  if (!dataUsers) return false;

  const [docId, userData] = dataUsers;
  const premiumDate = new Date(userData.premium);
  return !isNaN(premiumDate) && premiumDate > new Date();
}

/**
 * Reset semua money ke 0
 */
async function resetMoney() {
  getStmt('resetMoney', 'UPDATE users SET money = 0, updated_at = ?').run(new Date().toISOString());
}

/**
 * Hapus member yang tidak aktif > 30 hari
 */
function resetMemberOld() {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
  const result = getStmt('deleteMemberOld', 'DELETE FROM users WHERE updated_at < ?').run(cutoff);
  return result.changes;
}

/**
 * Reset semua limit ke 0
 */
async function resetLimit() {
  getStmt('resetLimit', 'UPDATE users SET limit_count = 0, updated_at = ?').run(
    new Date().toISOString(),
  );
}

/**
 * Reset semua level ke 0
 */
async function resetLevel() {
  getStmt('resetLevel', 'UPDATE users SET level = 0, updated_at = ?').run(new Date().toISOString());
}

/**
 * Reset seluruh database users
 */
async function resetUsers() {
  getStmt('deleteAllUsers', 'DELETE FROM users').run();
}

/**
 * Reset seluruh database owners
 */
async function resetOwners() {
  getStmt('deleteAllOwners', 'DELETE FROM owners').run();
}

/**
 * User tidak aktif (> 7 hari)
 */
function getInactiveUsers() {
  const sevenDaysAgo = new Date(Date.now() - 7 * MS_IN_A_DAY).toISOString();
  const rows = getStmt(
    'inactiveUsers',
    'SELECT id, updated_at FROM users WHERE updated_at < ?',
  ).all(sevenDaysAgo);
  return rows.map((row) => ({ id: row.id, updatedAt: row.updated_at }));
}

/**
 * User aktif dalam N hari terakhir
 */
function getActiveUsers(TOTAL_HARI_SIDER) {
  const cutoff = new Date(Date.now() - TOTAL_HARI_SIDER * MS_IN_A_DAY).toISOString();
  const rows = getStmt('activeUsers', 'SELECT id, updated_at FROM users WHERE updated_at >= ?').all(
    cutoff,
  );
  return rows.map((row) => ({ id: row.id, updatedAt: row.updated_at }));
}

// ====== OWNER FUNCTIONS ======

// In-memory cache for owner (dimuat dari SQLite)
let dbOwner = [];

function loadOwners() {
  const rows = getStmt('allOwners', 'SELECT number FROM owners').all();
  dbOwner = rows.map((r) => r.number);
}

// Load owners saat startup
loadOwners();

function generateAllOwnerIds() {
  try {
    const ownerNumbers = Array.isArray(config?.owner_number) ? config.owner_number : [];
    const dbOwnerNumbers = Array.isArray(dbOwner) ? dbOwner : [];
    const rawIds = [...ownerNumbers, ...dbOwnerNumbers];
    const allIds = new Set();

    for (const raw of rawIds) {
      if (typeof raw !== 'string' || !raw.trim()) continue;
      let base = raw.trim();

      if (base.includes('@')) {
        const parts = base.split('@');
        if (parts[0]) {
          base = parts[0];
        } else {
          continue;
        }
        allIds.add(raw.trim());
      }

      allIds.add(`${base}@s.whatsapp.net`);
      allIds.add(`${base}@lid`);
    }

    return Array.from(allIds);
  } catch (error) {
    console.error('Error in generateAllOwnerIds:', error);
    return [];
  }
}

function isOwner(remoteJid) {
  const ownerIds = generateAllOwnerIds();
  return ownerIds.includes(remoteJid);
}

function formatJid(number) {
  if (!number.includes('@')) {
    return `${number}@s.whatsapp.net`;
  }
  return number;
}

function listOwner() {
  const ownerJids = config.owner_number.map(formatJid);
  const dbJids = dbOwner.map(formatJid);

  return [...ownerJids, ...dbJids];
}
function addOwner(number) {
  if (dbOwner.includes(number)) return false;
  try {
    getStmt('insertOwner', 'INSERT OR IGNORE INTO owners (number) VALUES (?)').run(number);
    dbOwner.push(number);
    return true;
  } catch {
    return false;
  }
}

function delOwner(number) {
  const index = dbOwner.indexOf(number);
  if (index === -1) return false;
  getStmt('deleteOwner', 'DELETE FROM owners WHERE number = ?').run(number);
  dbOwner.splice(index, 1);
  return true;
}

// ====== Dummy save functions (no-op karena SQLite auto-persist) ======
async function saveUsers() {
  /* no-op: SQLite auto-persist */
}
async function saveOwners() {
  /* no-op: SQLite auto-persist */
}

// Backward-compatible db & dbOwner exports
// Catatan: db export sebagai getter agar selalu sinkron
const db = new Proxy(
  {},
  {
    get(target, prop) {
      // Baca dari SQLite real-time
      const rows = getStmt('allUsersFull', 'SELECT * FROM users').all();
      const result = {};
      for (const row of rows) {
        result[row.id] = rowToUser(row);
      }
      return result[prop];
    },
    set(target, prop, value) {
      // Set ke SQLite
      if (value && typeof value === 'object') {
        addUser(prop, value);
      }
      return true;
    },
    has(target, prop) {
      const row = getStmt('getById', 'SELECT id FROM users WHERE id = ?').get(prop);
      return !!row;
    },
    ownKeys() {
      const rows = getStmt('allIds', 'SELECT id FROM users').all();
      return rows.map((r) => r.id);
    },
    getOwnPropertyDescriptor(target, prop) {
      const row = getStmt('getById', 'SELECT id FROM users WHERE id = ?').get(prop);
      if (row) {
        return { configurable: true, enumerable: true, value: rowToUser(row) };
      }
      return undefined;
    },
  },
);

/**
 * Ambil semua user yang punya data ulang tahun
 */
function getAllUsersWithBirthday() {
  const rows = getStmt('usersWithBirthday', 'SELECT * FROM users WHERE birthday IS NOT NULL').all();
  return rows.map((row) => [row.id, rowToUser(row)]);
}

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
  getAllUsersWithBirthday,
  db,
  dbOwner,
};
