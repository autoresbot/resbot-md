/**
 * group.js - Manajemen Group menggunakan SQLite
 * 
 * Refactored dari JSON file ke SQLite.
 * Semua fungsi export tetap sama agar backward compatible.
 */

import { getDb, safeJsonParse, toJson, initDatabase } from './database.js';

// Pastikan database diinisialisasi
initDatabase();

// =========================================================
// Daftar fitur default yang lengkap dan sinkron
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

function ensureAllFeatures(fitur) {
  if (!fitur || typeof fitur !== 'object') {
    return { ...DEFAULT_FITUR };
  }
  return { ...DEFAULT_FITUR, ...fitur };
}

// ==== Prepared Statements Cache ====
let stmtCache = {};

function getStmt(key, sql) {
  if (!stmtCache[key]) {
    stmtCache[key] = getDb().prepare(sql);
  }
  return stmtCache[key];
}

// ==== Helper: convert row ke format lama ====
function rowToGroup(row) {
  if (!row) return null;
  return {
    fitur: safeJsonParse(row.fitur, { ...DEFAULT_FITUR }),
    userBlock: safeJsonParse(row.user_block, []),
    fiturBlock: safeJsonParse(row.fitur_block, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==== CRUD Functions ====

async function readGroup() {
  const rows = getStmt('readAll', 'SELECT * FROM groups_data').all();
  const result = {};
  for (const row of rows) {
    result[row.id] = rowToGroup(row);
  }
  return result;
}

async function saveGroup() {
  // No-op: SQLite auto-persist
}

async function addGroup(id, userData) {
  try {
    const existing = getStmt('getById', 'SELECT id FROM groups_data WHERE id = ?').get(id);
    if (existing) return false;

    const fitur = ensureAllFeatures(userData?.fitur);

    getStmt('insertGroup', `
      INSERT INTO groups_data (id, fitur, user_block, fitur_block, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      toJson(fitur),
      toJson(userData?.userBlock || []),
      toJson(userData?.fiturBlock || []),
      new Date().toISOString(),
      new Date().toISOString()
    );
    return true;
  } catch (error) {
    console.error('Error adding group:', error);
    return false;
  }
}

async function updateGroup(id, updateData) {
  try {
    const row = getStmt('getGroupById', 'SELECT * FROM groups_data WHERE id = ?').get(id);
    if (!row) return false;

    const currentFitur = safeJsonParse(row.fitur, { ...DEFAULT_FITUR });
    const updatedFeatures = {
      ...currentFitur,
      ...(updateData.fitur || {}),
    };

    getStmt('updateGroup', `
      UPDATE groups_data SET fitur = ?, updated_at = ? WHERE id = ?
    `).run(toJson(updatedFeatures), new Date().toISOString(), id);

    return true;
  } catch (error) {
    console.error('Error updating group:', error);
    return false;
  }
}

async function deleteGroup(id) {
  try {
    const result = getStmt('deleteGroup', 'DELETE FROM groups_data WHERE id = ?').run(id);
    return result.changes > 0;
  } catch (error) {
    console.error('Error deleting group:', error);
    return false;
  }
}

async function findGroup(id, search = false) {
  try {
    if (search && id === 'owner') {
      let row = getStmt('getGroupById', 'SELECT * FROM groups_data WHERE id = ?').get(id);
      if (!row) {
        // Buat baru
        getStmt('insertGroup', `
          INSERT INTO groups_data (id, fitur, user_block, fitur_block, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, toJson({ ...DEFAULT_FITUR }), '[]', '[]', new Date().toISOString(), new Date().toISOString());
        row = getStmt('getGroupById', 'SELECT * FROM groups_data WHERE id = ?').get(id);
      }

      const data = rowToGroup(row);
      data.fitur = ensureAllFeatures(data.fitur);

      // Update fitur di DB jika ada perubahan
      getStmt('updateFitur', 'UPDATE groups_data SET fitur = ? WHERE id = ?')
        .run(toJson(data.fitur), id);

      return data;
    }

    let row = getStmt('getGroupById', 'SELECT * FROM groups_data WHERE id = ?').get(id);

    // Jika belum ada dan bukan 'owner', buat baru
    if (!row && id !== 'owner') {
      getStmt('insertGroup', `
        INSERT INTO groups_data (id, fitur, user_block, fitur_block, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, toJson({ ...DEFAULT_FITUR }), '[]', '[]', new Date().toISOString(), new Date().toISOString());
      row = getStmt('getGroupById', 'SELECT * FROM groups_data WHERE id = ?').get(id);
    }

    if (!row && id === 'owner') return null;

    const data = rowToGroup(row);
    data.fitur = ensureAllFeatures(data.fitur);

    // Update fitur di DB
    getStmt('updateFitur', 'UPDATE groups_data SET fitur = ? WHERE id = ?')
      .run(toJson(data.fitur), id);

    return data;
  } catch (error) {
    console.error('Error finding group:', error);
    return null;
  }
}

// ==== User Block ====

async function addUserBlock(id, sender) {
  try {
    const row = getStmt('getGroupById', 'SELECT * FROM groups_data WHERE id = ?').get(id);
    if (!row) return false;

    const userBlock = safeJsonParse(row.user_block, []);
    if (!userBlock.includes(sender)) {
      userBlock.push(sender);
    }

    getStmt('updateUserBlock', 'UPDATE groups_data SET user_block = ?, updated_at = ? WHERE id = ?')
      .run(toJson(userBlock), new Date().toISOString(), id);
    return true;
  } catch (error) {
    console.error('Error updating group:', error);
    return false;
  }
}

async function isUserBlocked(id, sender) {
  try {
    const row = getStmt('getGroupById', 'SELECT * FROM groups_data WHERE id = ?').get(id);
    if (!row) return false;

    const userBlock = safeJsonParse(row.user_block, []);
    return userBlock.includes(sender);
  } catch (error) {
    console.error('Error checking userBlock:', error);
    return false;
  }
}

async function removeUserFromBlock(id, sender) {
  try {
    const row = getStmt('getGroupById', 'SELECT * FROM groups_data WHERE id = ?').get(id);
    if (!row) return false;

    const userBlock = safeJsonParse(row.user_block, []);
    const index = userBlock.indexOf(sender);
    if (index === -1) return false;

    userBlock.splice(index, 1);
    getStmt('updateUserBlock', 'UPDATE groups_data SET user_block = ?, updated_at = ? WHERE id = ?')
      .run(toJson(userBlock), new Date().toISOString(), id);
    return true;
  } catch (error) {
    return false;
  }
}

async function getUserBlockList(id) {
  try {
    const row = getStmt('getGroupById', 'SELECT * FROM groups_data WHERE id = ?').get(id);
    if (!row) return false;

    return safeJsonParse(row.user_block, []);
  } catch (error) {
    console.error('Error fetching userBlock list:', error);
    return [];
  }
}

// ==== Fitur Block ====

async function addFiturBlock(id, command) {
  try {
    const row = getStmt('getGroupById', 'SELECT * FROM groups_data WHERE id = ?').get(id);
    if (!row) return false;

    const fiturBlock = safeJsonParse(row.fitur_block, []);
    if (!fiturBlock.includes(command)) {
      fiturBlock.push(command);
    }

    getStmt('updateFiturBlock', 'UPDATE groups_data SET fitur_block = ?, updated_at = ? WHERE id = ?')
      .run(toJson(fiturBlock), new Date().toISOString(), id);
    return true;
  } catch (error) {
    console.error('Error updating group:', error);
    return false;
  }
}

async function isFiturBlocked(id, command) {
  try {
    const row = getStmt('getGroupById', 'SELECT * FROM groups_data WHERE id = ?').get(id);
    if (!row) return false;

    const fiturBlock = safeJsonParse(row.fitur_block, []);
    return fiturBlock.includes(command);
  } catch (error) {
    console.error('Error checking fiturBlock:', error);
    return false;
  }
}

async function removeFiturFromBlock(id, command) {
  try {
    const row = getStmt('getGroupById', 'SELECT * FROM groups_data WHERE id = ?').get(id);
    if (!row) return false;

    const fiturBlock = safeJsonParse(row.fitur_block, []);
    const index = fiturBlock.indexOf(command);
    if (index === -1) return false;

    fiturBlock.splice(index, 1);
    getStmt('updateFiturBlock', 'UPDATE groups_data SET fitur_block = ?, updated_at = ? WHERE id = ?')
      .run(toJson(fiturBlock), new Date().toISOString(), id);
    return true;
  } catch (error) {
    return false;
  }
}

// ==== Reset & Replace ====

async function resetGroup() {
  try {
    getStmt('deleteAllGroups', 'DELETE FROM groups_data').run();
    console.log('🔄 Database grup telah di-reset');
  } catch (error) {
    console.error('❌ Gagal me-reset database:', error);
  }
}

async function replaceGroup(newData) {
  try {
    const db = getDb();
    const transaction = db.transaction(() => {
      // Hapus semua data lama
      getStmt('deleteAllGroups', 'DELETE FROM groups_data').run();

      // Insert data baru
      const insertStmt = db.prepare(`
        INSERT INTO groups_data (id, fitur, user_block, fitur_block, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const [id, group] of Object.entries(newData)) {
        insertStmt.run(
          id,
          toJson(group.fitur || {}),
          toJson(group.userBlock || []),
          toJson(group.fiturBlock || []),
          group.createdAt || new Date().toISOString(),
          group.updatedAt || new Date().toISOString()
        );
      }
    });

    transaction();
  } catch (error) {
    console.error('❌ Error replacing group data:', error);
  }
}

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
