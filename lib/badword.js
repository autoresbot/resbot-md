/**
 * badword.js - Manajemen Badword menggunakan SQLite
 * 
 * Refactored dari JSON file ke SQLite.
 * Semua fungsi export tetap sama agar backward compatible.
 */

import { getDb, safeJsonParse, toJson, initDatabase } from './database.js';

// Pastikan database diinisialisasi
initDatabase();

// ==== Prepared Statements Cache ====
let stmtCache = {};

function getStmt(key, sql) {
  if (!stmtCache[key]) {
    stmtCache[key] = getDb().prepare(sql);
  }
  return stmtCache[key];
}

/**
 * Membaca semua data badword
 */
async function readBadword() {
  try {
    const rows = getStmt('readAll', 'SELECT * FROM badwords').all();
    const result = {};
    for (const row of rows) {
      result[row.id] = safeJsonParse(row.data, {});
    }
    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * Menyimpan data badword (full replace untuk satu entry)
 */
async function saveBadword(data) {
  try {
    const db = getDb();
    const transaction = db.transaction(() => {
      // Hapus semua data lama
      getStmt('deleteAll', 'DELETE FROM badwords').run();

      // Insert data baru
      const insertStmt = db.prepare(`
        INSERT INTO badwords (id, data, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `);

      for (const [id, badwordData] of Object.entries(data)) {
        insertStmt.run(
          id,
          toJson(badwordData),
          badwordData.createdAt || new Date().toISOString(),
          badwordData.updatedAt || new Date().toISOString()
        );
      }
    });

    transaction();
  } catch (error) {
    throw error;
  }
}

/**
 * Menambahkan data badword
 */
async function addBadword(id, userData) {
  try {
    const existing = getStmt('getById', 'SELECT id FROM badwords WHERE id = ?').get(id);
    if (existing) return false;

    const newData = {
      ...userData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    getStmt('insertBadword', `
      INSERT INTO badwords (id, data, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(id, toJson(newData), newData.createdAt, newData.updatedAt);

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Memperbarui data badword
 */
async function updateBadword(id, updateData) {
  try {
    const row = getStmt('getByIdFull', 'SELECT * FROM badwords WHERE id = ?').get(id);
    if (!row) {
      console.log('BADWORD ID TIDAK DITEMUKAN');
      return false;
    }

    const currentData = safeJsonParse(row.data, {});
    const merged = {
      ...currentData,
      ...updateData,
      updatedAt: new Date().toISOString(),
    };

    getStmt('updateBadword', 'UPDATE badwords SET data = ?, updated_at = ? WHERE id = ?')
      .run(toJson(merged), merged.updatedAt, id);

    return true;
  } catch (error) {
    console.log('ERROR UPDATE BADWORD:', error);
    return false;
  }
}

/**
 * Menghapus data badword
 */
async function deleteBadword(id) {
  try {
    const result = getStmt('deleteBadword', 'DELETE FROM badwords WHERE id = ?').run(id);
    return result.changes > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Mencari data badword berdasarkan ID
 */
async function findBadword(id) {
  try {
    const row = getStmt('getByIdFull', 'SELECT * FROM badwords WHERE id = ?').get(id);
    if (!row) return null;
    return safeJsonParse(row.data, null);
  } catch (error) {
    return null;
  }
}

/**
 * Cek apakah teks mengandung badword
 */
async function containsBadword(groupId, text) {
  try {
    const row = getStmt('getByIdFull', 'SELECT * FROM badwords WHERE id = ?').get(groupId);
    if (!row) return { status: false, words: '' };

    const badwordData = safeJsonParse(row.data, {});

    if (!badwordData || !Array.isArray(badwordData.listBadword)) {
      return { status: false, words: '' };
    }

    const listBadword = badwordData.listBadword;
    const detectedWords = listBadword.filter((badword) =>
      text.toLowerCase().includes(badword.toLowerCase()),
    );

    return {
      status: detectedWords.length > 0,
      words: detectedWords.join(','),
    };
  } catch (error) {
    console.error('Error checking badword:', error);
    return { status: false, words: '' };
  }
}

export {
  readBadword,
  saveBadword,
  addBadword,
  updateBadword,
  deleteBadword,
  findBadword,
  containsBadword,
};
