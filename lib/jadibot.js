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
    result[row.number] = { status: row.status, expired_at: row.expired_at ?? null };
  }
  return result;
}

/**
 * Daftar jadibot yang MASA AKTIFNYA sudah habis tapi belum di-stop.
 * Dipakai pengawas untuk menghentikannya otomatis (lib/jadibotGuard.js).
 * @returns {string[]} daftar nomor
 */
function getExpiredJadibot() {
  const now = Date.now();
  const rows = getStmt(
    'getExpired',
    "SELECT number FROM jadibot WHERE expired_at IS NOT NULL AND expired_at <= ? AND status != 'stop'",
  ).all(now);
  return rows.map((r) => r.number);
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
  return { status: row.status, expired_at: row.expired_at ?? null };
}

/**
 * Update atau tambah jadibot.
 *
 * @param {string} number
 * @param {string} status
 * @param {number} [expiredAt] timestamp ms kedaluwarsa. `undefined` = jangan
 *   sentuh nilai lama; `null` = hapus kedaluwarsa (aktif selamanya).
 */
async function updateJadibot(number, status, expiredAt) {
  const aturExpiry = expiredAt !== undefined; // hanya ubah kolom bila diberikan
  const existing = getStmt('getByNumber', 'SELECT * FROM jadibot WHERE number = ?').get(number);

  if (existing) {
    if (aturExpiry) {
      getStmt('updateStatusExp', 'UPDATE jadibot SET status = ?, expired_at = ? WHERE number = ?')
        .run(status, expiredAt, number);
    } else {
      getStmt('updateStatus', 'UPDATE jadibot SET status = ? WHERE number = ?').run(status, number);
    }
  } else {
    getStmt('insertJadibot', 'INSERT INTO jadibot (number, status, expired_at) VALUES (?, ?, ?)')
      .run(number, status, aturExpiry ? expiredAt : null);
  }
  return true;
}

export { listJadibot, deleteJadibot, updateJadibot, getJadibot, getExpiredJadibot };
