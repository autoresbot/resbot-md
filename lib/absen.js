/**
 * absen.js - Manajemen Absen menggunakan SQLite
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
 * Membaca semua data absen
 */
async function readAbsen() {
  try {
    const rows = getStmt('readAll', 'SELECT * FROM absen').all();
    const result = {};
    for (const row of rows) {
      result[row.id] = safeJsonParse(row.data, {});
    }
    return result;
  } catch (error) {
    console.error('[readAbsen] Error:', error);
    throw error;
  }
}

/**
 * Menyimpan data absen (full replace)
 */
async function saveAbsen(data) {
  try {
    const db = getDb();
    const transaction = db.transaction(() => {
      getStmt('deleteAll', 'DELETE FROM absen').run();
      const insertStmt = db.prepare('INSERT INTO absen (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)');
      for (const [id, absenData] of Object.entries(data)) {
        insertStmt.run(
          id,
          toJson(absenData),
          absenData.createdAt || '',
          absenData.updatedAt || ''
        );
      }
    });
    transaction();
  } catch (error) {
    console.error('[saveAbsen] Error:', error);
    throw error;
  }
}

/**
 * Menambahkan absen baru
 */
async function createAbsen(id, userData) {
  const today = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  try {
    const existing = getStmt('getById', 'SELECT id FROM absen WHERE id = ?').get(id);
    if (existing) return false;

    const newData = {
      ...userData,
      createdAt: today,
    };

    getStmt('insertAbsen', 'INSERT INTO absen (id, data, created_at) VALUES (?, ?, ?)')
      .run(id, toJson(newData), today);

    return true;
  } catch (error) {
    console.error(`[createAbsen] Error creating absen with ID "${id}":`, error);
    return false;
  }
}

/**
 * Memperbarui data absen
 */
async function updateAbsen(id, updateData) {
  try {
    const row = getStmt('getByIdFull', 'SELECT * FROM absen WHERE id = ?').get(id);
    if (!row) return false;

    const currentData = safeJsonParse(row.data, {});
    const merged = {
      ...currentData,
      ...updateData,
      updatedAt: new Date().toISOString(),
    };

    getStmt('updateAbsen', 'UPDATE absen SET data = ?, updated_at = ? WHERE id = ?')
      .run(toJson(merged), merged.updatedAt, id);

    return true;
  } catch (error) {
    console.error(`[updateAbsen] Error updating absen with ID "${id}":`, error);
    return false;
  }
}

/**
 * Menghapus absen
 */
async function deleteAbsen(id) {
  try {
    const result = getStmt('deleteAbsen', 'DELETE FROM absen WHERE id = ?').run(id);
    return result.changes > 0;
  } catch (error) {
    console.error(`[deleteAbsen] Error deleting absen with ID "${id}":`, error);
    return false;
  }
}

/**
 * Mencari absen berdasarkan ID (dengan reset harian)
 */
async function findAbsen(id) {
  const today = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  try {
    const row = getStmt('getByIdFull', 'SELECT * FROM absen WHERE id = ?').get(id);
    if (!row) return null;

    const absenData = safeJsonParse(row.data, null);
    if (!absenData) return null;

    if (absenData.createdAt !== today) {
      // Reset jika hari berganti
      absenData.member = [];
      absenData.createdAt = today;

      getStmt('updateAbsen', 'UPDATE absen SET data = ?, created_at = ? WHERE id = ?')
        .run(toJson(absenData), today, id);
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
