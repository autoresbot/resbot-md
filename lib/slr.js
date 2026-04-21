/**
 * slr.js - Manajemen SLR (Slow Response) menggunakan SQLite
 * 
 * Refactored dari JSON file ke SQLite.
 * Semua fungsi export tetap sama agar backward compatible.
 */

import { getDb, initDatabase } from './database.js';

initDatabase();

let stmtCache = {};

function getStmt(key, sql) {
  if (!stmtCache[key]) {
    stmtCache[key] = getDb().prepare(sql);
  }
  return stmtCache[key];
}

/**
 * Cek apakah file ada (backward compat, tetap export)
 */
export async function fileExists(filePath) {
  try {
    const { promises: fs } = await import('fs');
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Tambah/update SLR
 */
async function addSlr(id_grup, status, message) {
  try {
    const existing = getStmt('getById', 'SELECT id FROM slr WHERE id = ?').get(id_grup);

    if (existing) {
      getStmt('updateSlr', 'UPDATE slr SET status = ?, message = ? WHERE id = ?')
        .run(status ? 1 : 0, message || '', id_grup);
    } else {
      getStmt('insertSlr', 'INSERT INTO slr (id, status, message) VALUES (?, ?, ?)')
        .run(id_grup, status ? 1 : 0, message || '');
    }
  } catch (error) {
    console.error('Terjadi kesalahan saat menyimpan data:', error);
  }
}

/**
 * Cek message SLR untuk group
 */
async function SLRcheckMessage(id_grup) {
  try {
    const row = getStmt('getByIdFull', 'SELECT * FROM slr WHERE id = ?').get(id_grup);
    if (!row) return null;

    if (row.status === 1) {
      return row.message || null;
    }
    return null;
  } catch (error) {
    console.error('Terjadi kesalahan saat membaca data:', error);
    return null;
  }
}

export { addSlr, SLRcheckMessage };
