/**
 * database.js - Abstraction Layer untuk SQLite
 *
 * Layer ini mengelola koneksi SQLite, schema, dan helper functions.
 * Menggunakan better-sqlite3 (synchronous, high-performance).
 *
 * Semua operasi database melewati layer ini untuk memudahkan maintenance.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'database', 'bot.db');

let db = null;

/**
 * Inisialisasi koneksi database dan buat schema
 */
function initDatabase() {
  if (db) return db;

  db = new Database(DB_PATH);

  // Optimasi performa SQLite
  db.pragma('journal_mode = WAL'); // Write-Ahead Logging untuk concurrent access
  db.pragma('synchronous = NORMAL'); // Balance antara safety dan speed
  db.pragma('cache_size = -64000'); // 64MB cache
  db.pragma('foreign_keys = ON'); // Aktifkan foreign keys
  db.pragma('temp_store = MEMORY'); // Temp tables di memory

  createTables();
  migrateSchema();

  console.log('[✔] SQLite database initialized (WAL mode)');
  return db;
}

/**
 * Migrasi schema: tambah kolom baru jika belum ada
 */
function migrateSchema() {
  const columns = db
    .prepare('PRAGMA table_info(users)')
    .all()
    .map((c) => c.name);
  if (!columns.includes('birthday')) {
    db.exec('ALTER TABLE users ADD COLUMN birthday TEXT DEFAULT NULL');
  }
  if (!columns.includes('birth_year')) {
    db.exec('ALTER TABLE users ADD COLUMN birth_year INTEGER DEFAULT NULL');
  }
  if (!columns.includes('last_birthday_wish')) {
    db.exec('ALTER TABLE users ADD COLUMN last_birthday_wish INTEGER DEFAULT NULL');
  }
  if (!columns.includes('last_claim')) {
    db.exec('ALTER TABLE users ADD COLUMN last_claim INTEGER DEFAULT NULL');
  }
}

/**
 * Buat semua tabel yang dibutuhkan
 */
function createTables() {
  db.exec(`
    -- Tabel Users
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      aliases TEXT DEFAULT '[]',
      money INTEGER DEFAULT 0,
      limit_count INTEGER DEFAULT 0,
      level_cache INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      role TEXT DEFAULT 'user',
      achievement TEXT DEFAULT 'gamers',
      status TEXT DEFAULT 'active',
      premium TEXT DEFAULT NULL,
      afk TEXT DEFAULT '{"lastchat":0,"alasan":null}',
      birthday TEXT DEFAULT NULL,
      birth_year INTEGER DEFAULT NULL,
      last_birthday_wish INTEGER DEFAULT NULL,
      last_claim INTEGER DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Tabel Owners
    CREATE TABLE IF NOT EXISTS owners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT UNIQUE NOT NULL
    );

    -- Tabel Groups
    CREATE TABLE IF NOT EXISTS groups_data (
      id TEXT PRIMARY KEY,
      fitur TEXT DEFAULT '{}',
      user_block TEXT DEFAULT '[]',
      fitur_block TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Tabel Badwords
    CREATE TABLE IF NOT EXISTS badwords (
      id TEXT PRIMARY KEY,
      data TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Tabel Sewa
    CREATE TABLE IF NOT EXISTS sewa (
      id TEXT PRIMARY KEY,
      data TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Tabel Jadibot 
    CREATE TABLE IF NOT EXISTS jadibot (
      number TEXT PRIMARY KEY,
      status TEXT DEFAULT 'inactive'
    );

    -- Tabel List (keyword per group)
    CREATE TABLE IF NOT EXISTS list (
      id TEXT PRIMARY KEY,
      data TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Tabel SLR (Slow Response)
    CREATE TABLE IF NOT EXISTS slr (
      id TEXT PRIMARY KEY,
      status INTEGER DEFAULT 0,
      message TEXT DEFAULT ''
    );

    -- Tabel Total Chat
    CREATE TABLE IF NOT EXISTS totalchat (
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT '',
      PRIMARY KEY (group_id, user_id)
    );

    -- Tabel Absen
    CREATE TABLE IF NOT EXISTS absen (
      id TEXT PRIMARY KEY,
      data TEXT DEFAULT '{}',
      created_at TEXT DEFAULT '',
      updated_at TEXT DEFAULT ''
    );

    -- Tabel Participants (group settings: welcome, left, dll)
    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      data TEXT DEFAULT '{}'
    );

    -- Tabel Media Files
    CREATE TABLE IF NOT EXISTS media_files (
      id TEXT PRIMARY KEY,
      data TEXT DEFAULT '{}'
    );

    -- Index untuk performa
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users(updated_at);
    CREATE INDEX IF NOT EXISTS idx_totalchat_group ON totalchat(group_id);
  `);
}

/**
 * Dapatkan instance database
 */
function getDb() {
  if (!db) {
    initDatabase();
  }
  return db;
}

/**
 * Tutup koneksi database dengan aman
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('[✔] SQLite database closed');
  }
}

/**
 * Jalankan query dalam transaction untuk atomicity
 */
function runTransaction(fn) {
  const transaction = getDb().transaction(fn);
  return transaction();
}

/**
 * Helper: Parse JSON dengan fallback
 */
function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * Helper: Stringify ke JSON
 */
function toJson(obj) {
  return JSON.stringify(obj);
}

// Tutup database saat process exit
process.on('exit', () => {
  closeDatabase();
});

process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});

export { initDatabase, getDb, closeDatabase, runTransaction, safeJsonParse, toJson };
