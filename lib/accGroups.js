/**
 * accGroups.js - Grup yang diaktifkan owner lewat .acc
 *
 * Bot DIAM di semua grup (tidak membalas, tidak menjalankan fitur apa pun)
 * kecuali grup yang sudah di-.acc owner. Owner sendiri tetap dilayani di grup
 * mana pun supaya bisa mengetik .acc.
 *
 * Grup sewa ikut terhubung: menambah sewa otomatis meng-acc grupnya, dan
 * sewa yang dihapus/habis otomatis meng-unacc (lihat lib/sewa.js).
 */

import { getDb, initDatabase } from './database.js';

initDatabase();

/** Daftar dimuat ulang berkala supaya edit dari dashboard ikut terbaca. */
const MUAT_ULANG_MS = 60 * 1000;

let accSet = null;
let dimuatPada = 0;

function muatAccSet() {
  const rows = getDb().prepare('SELECT id FROM acc_groups').all();
  accSet = new Set(rows.map((row) => row.id));
  dimuatPada = Date.now();
}

/**
 * Apakah grup ini sudah diaktifkan? Dipanggil untuk SETIAP pesan grup, jadi
 * cukup cek Set di memori (tanpa query database).
 */
function isAccGroup(groupId) {
  if (!groupId) return false;
  if (!accSet || Date.now() - dimuatPada > MUAT_ULANG_MS) muatAccSet();
  return accSet.has(groupId);
}

/** @returns {boolean} false kalau grup memang sudah aktif */
function accGroup(groupId, addedBy = 'owner') {
  if (!groupId?.endsWith('@g.us')) return false;
  const hasil = getDb()
    .prepare(
      "INSERT OR IGNORE INTO acc_groups (id, added_by, created_at) VALUES (?, ?, datetime('now'))",
    )
    .run(groupId, addedBy);
  if (accSet) accSet.add(groupId);
  return hasil.changes > 0;
}

/** @returns {boolean} false kalau grup memang belum aktif */
function unaccGroup(groupId) {
  if (!groupId) return false;
  const hasil = getDb().prepare('DELETE FROM acc_groups WHERE id = ?').run(groupId);
  if (accSet) accSet.delete(groupId);
  return hasil.changes > 0;
}

/**
 * Aktifkan banyak grup sekaligus (.accall).
 * @returns {number} jumlah grup yang BARU diaktifkan
 */
function accGroups(groupIds = [], addedBy = 'owner') {
  const db = getDb();
  let baru = 0;
  const insert = db.prepare(
    "INSERT OR IGNORE INTO acc_groups (id, added_by, created_at) VALUES (?, ?, datetime('now'))",
  );

  db.transaction(() => {
    for (const id of groupIds) {
      if (!id?.endsWith('@g.us')) continue;
      if (insert.run(id, addedBy).changes > 0) baru++;
      if (accSet) accSet.add(id);
    }
  })();

  return baru;
}

/**
 * Nonaktifkan semua grup (.unaccall).
 *
 * Grup sewa SENGAJA dilewati: itu grup yang sedang membayar, mematikannya
 * diam-diam berarti mematikan layanan pelanggan. Pakai `ikutSewa: true` kalau
 * memang ingin ikut dimatikan.
 *
 * @returns {{ dimatikan: number, sewaDilewati: number }}
 */
function unaccAll({ ikutSewa = false } = {}) {
  const db = getDb();
  const sewaDilewati = ikutSewa
    ? 0
    : db.prepare("SELECT COUNT(*) AS c FROM acc_groups WHERE added_by = 'sewa'").get().c;

  const hasil = ikutSewa
    ? db.prepare('DELETE FROM acc_groups').run()
    : db.prepare("DELETE FROM acc_groups WHERE added_by != 'sewa'").run();

  accSet = null; // muat ulang dari database saat dipakai berikutnya
  return { dimatikan: hasil.changes, sewaDilewati };
}

/** @returns {{ id: string, added_by: string, created_at: string }[]} */
function listAccGroups() {
  return getDb().prepare('SELECT * FROM acc_groups ORDER BY created_at').all();
}

export { isAccGroup, accGroup, accGroups, unaccGroup, unaccAll, listAccGroups };
