/**
 * silent.js - User yang dibungkam di sebuah grup (.silent)
 *
 * Selama masa silent, setiap pesan orang itu langsung dihapus bot
 * (lihat handle/silent.js). Bot HARUS admin grup agar bisa menghapus.
 *
 * User disimpan sebagai NOMOR saja (tanpa @lid / @s.whatsapp.net) supaya
 * cocok dipakai di grup ber-alamat LID maupun nomor telepon biasa.
 */

import { getDb, initDatabase } from './database.js';
import { nomorDari } from './cache.js';

initDatabase();

let stmtCache = {};

function getStmt(key, sql) {
  if (!stmtCache[key]) {
    stmtCache[key] = getDb().prepare(sql);
  }
  return stmtCache[key];
}

/**
 * Bungkam seorang user.
 * @param {number} sampai timestamp ms, 0 = selamanya
 * @returns {boolean}
 */
function setSilent(groupId, identitas, { sampai = 0, alasan = '', oleh = '' } = {}) {
  const nomor = nomorDari(identitas);
  if (!groupId || !nomor) return false;

  getStmt(
    'insertSilent',
    `INSERT INTO silent (group_id, user_id, until, reason, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(group_id, user_id) DO UPDATE SET
       until = excluded.until, reason = excluded.reason, created_by = excluded.created_by`,
  ).run(groupId, nomor, sampai, alasan, oleh);

  return true;
}

/** @returns {boolean} false kalau memang tidak sedang di-silent */
function removeSilent(groupId, ...identitas) {
  const nomor = identitas.map(nomorDari).filter(Boolean);
  if (!groupId || nomor.length === 0) return false;

  const tanda = nomor.map(() => '?').join(', ');
  const hasil = getDb()
    .prepare(`DELETE FROM silent WHERE group_id = ? AND user_id IN (${tanda})`)
    .run(groupId, ...nomor);

  return hasil.changes > 0;
}

/**
 * Sedang di-silent atau tidak? Dicek lewat SEMUA bentuk identitas, karena
 * pengirim bisa dikenali sebagai LID maupun nomor telepon.
 *
 * Data yang sudah lewat masa berlakunya langsung dibuang di sini, jadi tidak
 * perlu pembersihan terjadwal.
 *
 * @returns {{ user_id: string, until: number, reason: string }|null}
 */
function cekSilent(groupId, ...identitas) {
  const nomor = [...new Set(identitas.map(nomorDari).filter(Boolean))];
  if (!groupId || nomor.length === 0) return null;

  const tanda = nomor.map(() => '?').join(', ');
  const row = getDb()
    .prepare(`SELECT * FROM silent WHERE group_id = ? AND user_id IN (${tanda}) LIMIT 1`)
    .get(groupId, ...nomor);

  if (!row) return null;

  if (row.until && row.until <= Date.now()) {
    removeSilent(groupId, row.user_id);
    return null;
  }
  return row;
}

/** Daftar user yang sedang di-silent di grup ini (yang kedaluwarsa dibuang). */
function listSilent(groupId) {
  const rows = getDb()
    .prepare('SELECT * FROM silent WHERE group_id = ? ORDER BY created_at')
    .all(groupId);

  const sekarang = Date.now();
  const aktif = [];

  for (const row of rows) {
    if (row.until && row.until <= sekarang) {
      removeSilent(groupId, row.user_id);
      continue;
    }
    aktif.push(row);
  }
  return aktif;
}

export { setSilent, removeSilent, cekSilent, listSilent };
