/**
 * sewa.js - Manajemen Sewa Group menggunakan SQLite
 * 
 * Refactored dari JSON file ke SQLite.
 * Semua fungsi export tetap sama agar backward compatible.
 */

import { getDb, safeJsonParse, toJson, initDatabase } from './database.js';

initDatabase();

let stmtCache = {};

function getStmt(key, sql) {
  if (!stmtCache[key]) {
    stmtCache[key] = getDb().prepare(sql);
  }
  return stmtCache[key];
}

/**
 * Menambahkan atau update sewa
 */
async function addSewa(id, userData) {
  try {
    const existing = getStmt('getById', 'SELECT id FROM sewa WHERE id = ?').get(id);

    if (existing) {
      // Update
      const row = getStmt('getByIdFull', 'SELECT * FROM sewa WHERE id = ?').get(id);
      const currentData = safeJsonParse(row.data, {});
      const merged = {
        ...currentData,
        ...userData,
        updatedAt: new Date().toISOString(),
      };
      getStmt('updateSewa', 'UPDATE sewa SET data = ?, updated_at = ? WHERE id = ?')
        .run(toJson(merged), merged.updatedAt, id);
    } else {
      // Insert baru
      const newData = {
        ...userData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      getStmt('insertSewa', `
        INSERT INTO sewa (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)
      `).run(id, toJson(newData), newData.createdAt, newData.updatedAt);
    }

    return true;
  } catch (error) {
    console.error('Error adding or updating group:', error);
    return false;
  }
}

/**
 * Memperbarui data sewa
 */
async function updateSewa(id, updateData) {
  try {
    const row = getStmt('getByIdFull', 'SELECT * FROM sewa WHERE id = ?').get(id);
    if (!row) return false;

    const currentData = safeJsonParse(row.data, {});
    const merged = {
      ...currentData,
      ...updateData,
      updatedAt: new Date().toISOString(),
    };

    getStmt('updateSewa', 'UPDATE sewa SET data = ?, updated_at = ? WHERE id = ?')
      .run(toJson(merged), merged.updatedAt, id);

    return true;
  } catch (error) {
    console.error('Error updating group:', error);
    return false;
  }
}

/**
 * Menghapus sewa
 */
async function deleteSewa(id) {
  try {
    const result = getStmt('deleteSewa', 'DELETE FROM sewa WHERE id = ?').run(id);
    return result.changes > 0;
  } catch (error) {
    console.error('Error deleting group:', error);
    return false;
  }
}

/**
 * Mencari sewa berdasarkan ID
 */
async function findSewa(id) {
  try {
    const row = getStmt('getByIdFull', 'SELECT * FROM sewa WHERE id = ?').get(id);
    if (!row) return null;
    return safeJsonParse(row.data, null);
  } catch (error) {
    console.error('Error finding group:', error);
    return null;
  }
}

/**
 * List semua sewa
 */
async function listSewa() {
  try {
    const rows = getStmt('readAll', 'SELECT * FROM sewa').all();
    const result = {};
    for (const row of rows) {
      result[row.id] = safeJsonParse(row.data, {});
    }
    return result;
  } catch (error) {
    console.error('Error finding group:', error);
    return null;
  }
}

/**
 * Simpan data sewa (no-op karena SQLite auto-persist)
 */
async function saveSewa() {
  // No-op: SQLite auto-persist
}

export { saveSewa, addSewa, updateSewa, deleteSewa, findSewa, listSewa };
