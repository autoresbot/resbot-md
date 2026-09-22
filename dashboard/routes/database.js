/**
 * Kelola database SQLite (database/bot.db).
 *
 * Memakai koneksi yang SAMA dengan bot (getDb dari lib/database.js), jadi
 * tidak ada dua penulis yang berebut file. Baris diidentifikasi lewat rowid
 * sehingga tabel dengan primary key gabungan (mis. totalchat) tetap bisa diedit.
 *
 * Catatan: sebagian data (mis. daftar owner) di-cache bot di memori, jadi
 * perubahan dari dashboard untuk data itu baru terasa setelah bot restart.
 */

import express from 'express';
import { getDb } from '../../lib/database.js';
import { HttpError } from '../lib/files.js';

const router = express.Router();

const quote = (name) => `"${String(name).replace(/"/g, '""')}"`;

function listTables() {
  return getDb()
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all()
    .map((row) => row.name);
}

function getColumns(table) {
  return getDb().prepare(`PRAGMA table_info(${quote(table)})`).all();
}

function assertTable(table) {
  if (!listTables().includes(table)) throw new HttpError(404, `Tabel '${table}' tidak ada.`);
}

/**
 * Nilai dari form selalu berupa teks. Ubah sesuai tipe kolom:
 * teks `NULL` => null, kolom INTEGER/REAL => angka.
 */
function convertValue(value, column) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;
  if (value === 'NULL') return null;

  const type = String(column.type || '').toUpperCase();
  if (type.includes('INT') || type.includes('REAL') || type.includes('NUM')) {
    if (value.trim() === '') return null;
    const num = Number(value);
    if (Number.isNaN(num)) throw new HttpError(400, `Kolom '${column.name}' harus berupa angka.`);
    return num;
  }
  return value;
}

function pickValues(table, values = {}) {
  const columns = getColumns(table);
  const entries = [];
  for (const column of columns) {
    if (Object.prototype.hasOwnProperty.call(values, column.name)) {
      entries.push([column.name, convertValue(values[column.name], column)]);
    }
  }
  if (entries.length === 0) throw new HttpError(400, 'Tidak ada kolom yang diisi.');
  return entries;
}

router.get('/tables', (req, res) => {
  const db = getDb();
  const tables = listTables().map((name) => ({
    name,
    count: db.prepare(`SELECT COUNT(*) AS c FROM ${quote(name)}`).get().c,
  }));
  res.json({ tables });
});

router.get('/tables/:table', (req, res) => {
  const { table } = req.params;
  assertTable(table);

  const db = getDb();
  const columns = getColumns(table);
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 200);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const q = String(req.query.q || '').trim();

  let where = '';
  const params = [];
  if (q) {
    where = `WHERE ${columns.map((c) => `CAST(${quote(c.name)} AS TEXT) LIKE ?`).join(' OR ')}`;
    for (let i = 0; i < columns.length; i++) params.push(`%${q}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) AS c FROM ${quote(table)} ${where}`).get(...params).c;
  const rows = db
    .prepare(
      `SELECT rowid AS __rowid, * FROM ${quote(table)} ${where} ORDER BY rowid DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, (page - 1) * limit);

  res.json({
    table,
    columns: columns.map((c) => ({
      name: c.name,
      type: c.type,
      pk: c.pk > 0,
      notnull: !!c.notnull,
      default: c.dflt_value,
    })),
    rows,
    total,
    page,
    limit,
  });
});

router.post('/tables/:table', (req, res) => {
  const { table } = req.params;
  assertTable(table);
  const entries = pickValues(table, req.body?.values);
  const sql = `INSERT INTO ${quote(table)} (${entries.map(([k]) => quote(k)).join(', ')}) VALUES (${entries.map(() => '?').join(', ')})`;
  const info = getDb()
    .prepare(sql)
    .run(...entries.map(([, v]) => v));
  res.json({ ok: true, rowid: Number(info.lastInsertRowid) });
});

router.put('/tables/:table/:rowid', (req, res) => {
  const { table, rowid } = req.params;
  assertTable(table);
  const entries = pickValues(table, req.body?.values);
  const sql = `UPDATE ${quote(table)} SET ${entries.map(([k]) => `${quote(k)} = ?`).join(', ')} WHERE rowid = ?`;
  const info = getDb()
    .prepare(sql)
    .run(...entries.map(([, v]) => v), Number(rowid));
  if (info.changes === 0) throw new HttpError(404, 'Baris tidak ditemukan.');
  res.json({ ok: true });
});

router.delete('/tables/:table/:rowid', (req, res) => {
  const { table, rowid } = req.params;
  assertTable(table);
  const info = getDb()
    .prepare(`DELETE FROM ${quote(table)} WHERE rowid = ?`)
    .run(Number(rowid));
  if (info.changes === 0) throw new HttpError(404, 'Baris tidak ditemukan.');
  res.json({ ok: true });
});

/** Konsol SQL untuk kebutuhan yang tidak tercakup form. */
router.post('/query', (req, res) => {
  const sql = String(req.body?.sql || '').trim();
  if (!sql) throw new HttpError(400, 'Query kosong.');

  const stmt = getDb().prepare(sql);
  if (stmt.reader) {
    const rows = stmt.all();
    return res.json({ rows: rows.slice(0, 500), total: rows.length });
  }
  const info = stmt.run();
  res.json({ changes: info.changes, lastInsertRowid: Number(info.lastInsertRowid) });
});

export default router;
