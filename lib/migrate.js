/**
 * migrate.js - Script migrasi dari JSON ke SQLite
 *
 * Script ini membaca semua file JSON di folder database/
 * dan memigrasikan datanya ke SQLite.
 *
 * PENTING: File JSON asli TIDAK dihapus (sebagai backup).
 *
 * Jalankan: node lib/migrate.js
 */

import { initDatabase, getDb, toJson, runTransaction } from './database.js';
import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_DIR = path.join(__dirname, '..', 'database');

const DB_FILE = path.join(DB_DIR, 'bot.db');

async function forceResetDatabase() {
  try {
    await fsp.access(DB_FILE);
    console.log('[⚠] bot.db sudah ada, menghapus...');
    await fsp.unlink(DB_FILE);
    console.log('[✔] bot.db berhasil dihapus (akan dibuat ulang)');
  } catch {
    // file tidak ada → aman
  }
}

/**
 * Baca file JSON dengan aman
 */
async function readJsonSafe(filePath) {
  try {
    await fsp.access(filePath);
    const data = await fsp.readFile(filePath, 'utf8');
    const trimmed = data.trim();
    if (!trimmed || trimmed === '') return null;
    return JSON.parse(trimmed);
  } catch (error) {
    console.log(`⚠️ Tidak bisa membaca ${path.basename(filePath)}: ${error.message}`);
    return null;
  }
}

/**
 * Migrasi users.json
 */
function migrateUsers(db, data) {
  if (!data || typeof data !== 'object') return 0;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO users (id, username, aliases, money, limit_count, level_cache, level, role, achievement, status, premium, afk, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (const [id, user] of Object.entries(data)) {
    stmt.run(
      id,
      user.username || `user_${id}`,
      toJson(user.aliases || []),
      user.money || 0,
      user.limit || 0,
      user.level_cache || 0,
      user.level || 1,
      user.role || 'user',
      user.achievement || 'gamers',
      user.status || 'active',
      user.premium || null,
      toJson(user.afk || { lastchat: 0, alasan: null }),
      user.createdAt || new Date().toISOString(),
      user.updatedAt || new Date().toISOString(),
    );
    count++;
  }
  return count;
}

/**
 * Migrasi owner.json
 */
function migrateOwners(db, data) {
  if (!Array.isArray(data)) return 0;

  const stmt = db.prepare('INSERT OR IGNORE INTO owners (number) VALUES (?)');
  let count = 0;
  for (const number of data) {
    if (typeof number === 'string' && number.trim()) {
      stmt.run(number.trim());
      count++;
    }
  }
  return count;
}

/**
 * Migrasi group.json
 */
function migrateGroups(db, data) {
  if (!data || typeof data !== 'object') return 0;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO groups_data (id, fitur, user_block, fitur_block, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (const [id, group] of Object.entries(data)) {
    stmt.run(
      id,
      toJson(group.fitur || {}),
      toJson(group.userBlock || []),
      toJson(group.fiturBlock || []),
      group.createdAt || new Date().toISOString(),
      group.updatedAt || new Date().toISOString(),
    );
    count++;
  }
  return count;
}

/**
 * Migrasi badword.json
 */
function migrateBadwords(db, data) {
  if (!data || typeof data !== 'object') return 0;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO badwords (id, data, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);

  let count = 0;
  for (const [id, badwordData] of Object.entries(data)) {
    stmt.run(
      id,
      toJson(badwordData),
      badwordData.createdAt || new Date().toISOString(),
      badwordData.updatedAt || new Date().toISOString(),
    );
    count++;
  }
  return count;
}

/**
 * Migrasi sewa.json
 */
function migrateSewa(db, data) {
  if (!data || typeof data !== 'object') return 0;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO sewa (id, data, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);

  let count = 0;
  for (const [id, sewaData] of Object.entries(data)) {
    stmt.run(
      id,
      toJson(sewaData),
      sewaData.createdAt || new Date().toISOString(),
      sewaData.updatedAt || new Date().toISOString(),
    );
    count++;
  }
  return count;
}

/**
 * Migrasi jadibot.json
 */
function migrateJadibot(db, data) {
  if (!data || typeof data !== 'object') return 0;

  const stmt = db.prepare('INSERT OR IGNORE INTO jadibot (number, status) VALUES (?, ?)');
  let count = 0;
  for (const [number, jadibotData] of Object.entries(data)) {
    stmt.run(number, jadibotData.status || 'inactive');
    count++;
  }
  return count;
}

/**
 * Migrasi list.json
 */
function migrateList(db, data) {
  if (!data || typeof data !== 'object') return 0;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO list (id, data, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);

  let count = 0;
  for (const [id, listData] of Object.entries(data)) {
    stmt.run(
      id,
      toJson(listData),
      listData.createdAt || new Date().toISOString(),
      listData.updatedAt || new Date().toISOString(),
    );
    count++;
  }
  return count;
}

/**
 * Migrasi slr.json
 */
function migrateSlr(db, data) {
  if (!data || typeof data !== 'object') return 0;

  const stmt = db.prepare('INSERT OR IGNORE INTO slr (id, status, message) VALUES (?, ?, ?)');
  let count = 0;
  for (const [id, slrData] of Object.entries(data)) {
    stmt.run(id, slrData.status ? 1 : 0, slrData.message || '');
    count++;
  }
  return count;
}

/**
 * Migrasi totalchat.json
 */
function migrateTotalchat(db, data) {
  if (!data || typeof data !== 'object') return 0;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO totalchat (group_id, user_id, count, created_at)
    VALUES (?, ?, ?, ?)
  `);

  let count = 0;
  for (const [groupId, groupData] of Object.entries(data)) {
    const createdAt = groupData.createdAt || '';
    const members = groupData.members || {};
    for (const [userId, chatCount] of Object.entries(members)) {
      stmt.run(groupId, userId, chatCount || 0, createdAt);
      count++;
    }
  }
  return count;
}

/**
 * Migrasi absen.json
 */
function migrateAbsen(db, data) {
  if (!data || typeof data !== 'object') return 0;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO absen (id, data, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);

  let count = 0;
  for (const [id, absenData] of Object.entries(data)) {
    stmt.run(id, toJson(absenData), absenData.createdAt || '', absenData.updatedAt || '');
    count++;
  }
  return count;
}

/**
 * Migrasi group participant.json
 */
function migrateParticipants(db, data) {
  if (!data || typeof data !== 'object') return 0;

  const stmt = db.prepare('INSERT OR IGNORE INTO participants (id, data) VALUES (?, ?)');
  let count = 0;
  for (const [id, participantData] of Object.entries(data)) {
    stmt.run(id, toJson(participantData));
    count++;
  }
  return count;
}

/**
 * Migrasi mediaFiles.json
 */
function migrateMediaFiles(db, data) {
  if (!data || typeof data !== 'object') return 0;

  const stmt = db.prepare('INSERT OR IGNORE INTO media_files (id, data) VALUES (?, ?)');
  let count = 0;
  for (const [id, mediaData] of Object.entries(data)) {
    stmt.run(id, toJson(mediaData));
    count++;
  }
  return count;
}

/**
 * Cek apakah migrasi sudah dilakukan
 */
function isMigrated(db) {
  try {
    const result = db.prepare('SELECT COUNT(*) as count FROM users').get();
    const resultGroups = db.prepare('SELECT COUNT(*) as count FROM groups_data').get();
    // Jika sudah ada data, anggap sudah migrasi
    return result.count > 0 || resultGroups.count > 0;
  } catch {
    return false;
  }
}

/**
 * Jalankan seluruh migrasi
 */
async function runMigration() {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     📦 MIGRASI JSON → SQLite             ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  // 🔥 tambahkan ini
  await forceResetDatabase();

  // Inisialisasi database
  const db = initDatabase();

  console.log('[⏳] Membaca file JSON...');

  // Baca semua file JSON
  const [
    usersData,
    ownerData,
    groupData,
    badwordData,
    sewaData,
    jadibotData,
    listData,
    slrData,
    totalchatData,
    absenData,
    participantData,
    mediaFilesData,
  ] = await Promise.all([
    readJsonSafe(path.join(DB_DIR, 'users.json')),
    readJsonSafe(path.join(DB_DIR, 'owner.json')),
    readJsonSafe(path.join(DB_DIR, 'group.json')),
    readJsonSafe(path.join(DB_DIR, 'badword.json')),
    readJsonSafe(path.join(DB_DIR, 'sewa.json')),
    readJsonSafe(path.join(DB_DIR, 'jadibot.json')),
    readJsonSafe(path.join(DB_DIR, 'list.json')),
    readJsonSafe(path.join(DB_DIR, 'slr.json')),
    readJsonSafe(path.join(DB_DIR, 'additional', 'totalchat.json')),
    readJsonSafe(path.join(DB_DIR, 'additional', 'absen.json')),
    readJsonSafe(path.join(DB_DIR, 'additional', 'group participant.json')),
    readJsonSafe(path.join(DB_DIR, 'mediaFiles.json')),
  ]);

  console.log('[✔] File JSON berhasil dibaca');
  console.log('[⏳] Memulai migrasi dalam transaction...');

  // Jalankan semua migrasi dalam satu transaction
  const results = runTransaction(() => {
    return {
      users: migrateUsers(db, usersData),
      owners: migrateOwners(db, ownerData),
      groups: migrateGroups(db, groupData),
      badwords: migrateBadwords(db, badwordData),
      sewa: migrateSewa(db, sewaData),
      jadibot: migrateJadibot(db, jadibotData),
      list: migrateList(db, listData),
      slr: migrateSlr(db, slrData),
      totalchat: migrateTotalchat(db, totalchatData),
      absen: migrateAbsen(db, absenData),
      participants: migrateParticipants(db, participantData),
      mediaFiles: migrateMediaFiles(db, mediaFilesData),
    };
  });

  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     ✅ MIGRASI BERHASIL!                  ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log('Hasil migrasi:');
  for (const [table, count] of Object.entries(results)) {
    console.log(`  📋 ${table}: ${count} record`);
  }
  console.log('');
  console.log('⚠️  File JSON asli TIDAK dihapus (backup).');
  console.log('   Lokasi database: database/bot.db');
  console.log('');
}

// Jika dijalankan langsung (node lib/migrate.js)
const isMainModule =
  process.argv[1] &&
  (process.argv[1].endsWith('migrate.js') || process.argv[1].includes('migrate'));

if (isMainModule) {
  runMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migrasi gagal:', err);
      process.exit(1);
    });
}

export { runMigration };
