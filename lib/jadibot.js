/**
 * jadibot.js - Manajemen Jadibot menggunakan SQLite
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
 * List semua jadibot
 */
async function listJadibot() {
  const rows = getStmt('readAll', 'SELECT * FROM jadibot').all();
  const result = {};
  for (const row of rows) {
    result[row.number] = { status: row.status };
  }
  return result;
}

/**
 * Hapus jadibot
 */
async function deleteJadibot(number) {
  const result = getStmt('deleteJadibot', 'DELETE FROM jadibot WHERE number = ?').run(number);
  if (result.changes > 0) {
    return true;
  } else {
    console.log('Number not found');
    return false;
  }
}

/**
 * Get jadibot by number
 */
async function getJadibot(number) {
  const row = getStmt('getByNumber', 'SELECT * FROM jadibot WHERE number = ?').get(number);
  if (!row) return null;
  return { status: row.status };
}

/**
 * Update atau tambah jadibot
 */
async function updateJadibot(number, status) {
  const existing = getStmt('getByNumber', 'SELECT * FROM jadibot WHERE number = ?').get(number);
  if (existing) {
    getStmt('updateStatus', 'UPDATE jadibot SET status = ? WHERE number = ?').run(status, number);
  } else {
    getStmt('insertJadibot', 'INSERT INTO jadibot (number, status) VALUES (?, ?)').run(number, status);
  }
  return true;
}

export { listJadibot, deleteJadibot, updateJadibot, getJadibot };
