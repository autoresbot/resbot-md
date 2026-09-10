/**
 * database.js - Abstraction Layer untuk SQLite
 *
 * Layer ini mengelola koneksi SQLite, schema, dan helper functions.
 * Menggunakan better-sqlite3 (synchronous, high-performance).
 *
 * Semua operasi database melewati layer ini untuk memudahkan maintenance.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { spawnSync } from 'child_process';

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'database', 'bot.db');

let db = null;

/**
 * Kenali kegagalan yang disebabkan binary native better-sqlite3, bukan bug kode.
 *
 * Tiga bentuk yang sering muncul di panel (Pterodactyl dan sejenisnya):
 *  - "Could not locate the bindings file"  -> file .node tidak pernah dibuat,
 *    biasanya karena `npm install` dijalankan dengan --ignore-scripts sehingga
 *    script `install` (prebuild-install) tidak pernah jalan.
 *  - "NODE_MODULE_VERSION"                 -> binary dibuat untuk versi Node
 *    yang berbeda dengan yang dipakai menjalankan bot (ABI mismatch).
 *  - "invalid ELF header" / "wrong ELF"    -> binary dari OS/arsitektur lain,
 *    mis. node_modules ikut ter-upload dari Windows ke container Linux.
 */
function isNativeBindingError(error) {
  const pesan = String(error?.message ?? error);
  return (
    /could not locate the bindings file/i.test(pesan) ||
    /NODE_MODULE_VERSION/i.test(pesan) ||
    /invalid ELF header|wrong ELF class|not a valid Win32 application/i.test(pesan)
  );
}

/** Buang cache require agar binary hasil rebuild benar-benar dibaca ulang. */
function bersihkanCacheDriver() {
  for (const kunci of Object.keys(require.cache)) {
    if (kunci.includes('better-sqlite3') || kunci.includes(`${path.sep}bindings${path.sep}`)) {
      delete require.cache[kunci];
    }
  }
}

/**
 * Buka koneksi database, dan perbaiki sendiri kalau binary native-nya hilang
 * atau tidak cocok.
 *
 * PENTING: pada better-sqlite3 v12, `require()` SELALU berhasil — binary
 * native baru dimuat saat `new Database(...)` dipanggil. Jadi penjagaannya
 * harus membungkus pemanggilan konstruktor, bukan cuma require-nya. (Versi
 * lama melempar sejak require, dan itu tetap ikut tertangani di sini.)
 *
 * Driver dimuat lewat `createRequire`, bukan `import` statis di atas berkas,
 * supaya kegagalannya bisa DITANGKAP. Dengan import statis, prosesnya mati saat
 * modul dimuat — sebelum ada satu baris pun kode kita yang berjalan — sehingga
 * yang terlihat user cuma stack trace `bindings` yang membingungkan.
 *
 * `npm rebuild` menjalankan ulang script install milik better-sqlite3, yaitu
 * `prebuild-install || node-gyp rebuild`. Jalur pertama hanya MENGUNDUH binary
 * siap pakai yang cocok dengan versi Node saat ini — tidak butuh compiler — dan
 * itu sudah menyelesaikan sebagian besar kasus di panel.
 */
function openSqlite(dbPath) {
  try {
    const Database = require('better-sqlite3');
    return new Database(dbPath);
  } catch (error) {
    if (!isNativeBindingError(error)) throw error;

    console.warn('[!] Binary native better-sqlite3 tidak cocok/tidak ada.');
    console.warn(`[!] Penyebab: ${String(error.message).split('\n')[0]}`);
    console.warn('[~] Mencoba memperbaiki otomatis: npm rebuild better-sqlite3 ...');

    const hasil = spawnSync('npm', ['rebuild', 'better-sqlite3'], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      shell: process.platform === 'win32',
    });

    if (hasil.error) {
      console.warn(`[!] Gagal menjalankan npm: ${hasil.error.message}`);
    }

    try {
      bersihkanCacheDriver();
      const Database = require('better-sqlite3');
      const koneksi = new Database(dbPath);
      console.log('[✔] better-sqlite3 berhasil diperbaiki otomatis.');
      return koneksi;
    } catch (gagal) {
      throw new Error(
        [
          'better-sqlite3 tidak bisa dimuat dan perbaikan otomatis gagal.',
          '',
          `Node yang dipakai : ${process.version} (${process.platform}/${process.arch})`,
          `Pesan asli        : ${String(gagal.message).split('\n')[0]}`,
          '',
          'Langkah perbaikan manual, coba berurutan:',
          '  1) npm rebuild better-sqlite3',
          '  2) rm -rf node_modules && npm install       (JANGAN pakai --ignore-scripts)',
          '  3) npm install better-sqlite3 --build-from-source',
          '',
          'Catatan penting:',
          '  - JANGAN meng-upload folder node_modules dari komputer lain.',
          '    Binary native hanya cocok untuk OS, arsitektur, dan versi Node',
          '    tempat ia dibuat. Upload kodenya saja, lalu npm install di panel.',
          '  - Pastikan versi Node saat install SAMA dengan saat menjalankan bot.',
        ].join('\n'),
      );
    }
  }
}

/**
 * Inisialisasi koneksi database dan buat schema
 */
function initDatabase() {
  if (db) return db;

  db = openSqlite(DB_PATH);

  // Optimasi performa SQLite
  db.pragma('journal_mode = WAL'); // Write-Ahead Logging untuk concurrent access
  db.pragma('synchronous = FULL'); // FULL untuk keamanan data saat crash/restart
  db.pragma('cache_size = -64000'); // 64MB cache
  db.pragma('foreign_keys = ON'); // Aktifkan foreign keys
  db.pragma('temp_store = MEMORY'); // Temp tables di memory
  db.pragma('wal_autocheckpoint = 100'); // Checkpoint setiap 100 pages untuk meminimalisir data loss

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
    try {
      // Force WAL checkpoint sebelum close untuk memastikan semua data ter-flush ke disk
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (e) {
      // Ignore error jika checkpoint gagal (misalnya saat crash)
    }
    db.close();
    db = null;
    console.log('[✔] SQLite database closed (WAL checkpointed)');
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

// PENTING: Handle SIGTERM (dipakai oleh PM2, Docker, hosting panel saat restart)
process.on('SIGTERM', () => {
  console.log('[⚠] SIGTERM received, closing database safely...');
  closeDatabase();
  process.exit(0);
});

export { initDatabase, getDb, closeDatabase, runTransaction, safeJsonParse, toJson };
