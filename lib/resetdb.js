/**
 * resetdb.js - Kosongkan seluruh isi database/bot.db (persiapan production)
 *
 * Yang dilakukan:
 *  1. Buka database lewat initDatabase() — schema & migrasi kolom ikut
 *     dipastikan terbaru, jadi hasil reset = database baru yang siap pakai.
 *  2. Hapus SEMUA baris dari semua tabel (struktur tabel tetap ada),
 *     termasuk penghitung AUTOINCREMENT (sqlite_sequence).
 *  3. VACUUM + checkpoint WAL, sehingga file bot.db benar-benar mengecil
 *     dan tidak ada sisa data lama di bot.db-wal.
 *
 * Sengaja TIDAK menghapus file bot.db: di Linux file yang masih dibuka bot
 * tetap bisa "dihapus" tanpa error, lalu bot terus menulis ke file hantu.
 * Mengosongkan lewat koneksi SQLite aman di Windows maupun Linux.
 *
 * Folder session/, local.config.js, dan file lain di database/ TIDAK disentuh.
 *
 * Jalankan (MATIKAN BOT DULU):
 *   npm run resetdb              -> minta konfirmasi
 *   npm run resetdb -- --yes     -> tanpa konfirmasi
 *   npm run resetdb -- --backup  -> simpan salinan dulu ke tmp/
 */

import { initDatabase, closeDatabase, backupDatabase } from './database.js';
import { createInterface } from 'readline';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const args = process.argv.slice(2);
const SKIP_CONFIRM = args.includes('--yes') || args.includes('-y');
const WITH_BACKUP = args.includes('--backup');

function tanya(pertanyaan) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(pertanyaan, (jawab) => {
      rl.close();
      resolve(jawab.trim());
    });
  });
}

function daftarTabel(db) {
  return db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name`,
    )
    .all()
    .map((r) => r.name);
}

function hitungBaris(db, tabel) {
  return db.prepare(`SELECT COUNT(*) AS n FROM "${tabel.replace(/"/g, '""')}"`).get().n;
}

async function resetDatabase() {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     🗑️  RESET DATABASE (bot.db)           ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  const db = initDatabase();
  const tabel = daftarTabel(db);
  const isi = tabel.map((t) => ({ t, n: hitungBaris(db, t) }));
  const total = isi.reduce((a, b) => a + b.n, 0);

  console.log('Isi database saat ini:');
  for (const { t, n } of isi) {
    if (n > 0) console.log(`  📋 ${t}: ${n} baris`);
  }
  console.log(`  Total: ${total} baris di ${tabel.length} tabel`);
  console.log('');

  if (total === 0) {
    console.log('[✔] Database sudah kosong, tidak ada yang perlu direset.');
    return;
  }

  if (!SKIP_CONFIRM) {
    if (!process.stdin.isTTY) {
      console.log('[!] Tidak ada terminal interaktif. Jalankan dengan --yes untuk melanjutkan.');
      process.exitCode = 1;
      return;
    }
    console.log('⚠️  SEMUA data di atas akan DIHAPUS PERMANEN.');
    console.log('⚠️  Pastikan bot sudah DIMATIKAN sebelum melanjutkan.');
    const jawab = await tanya('Ketik "RESET" untuk melanjutkan: ');
    if (jawab !== 'RESET') {
      console.log('[✖] Dibatalkan, database tidak diubah.');
      return;
    }
  }

  if (WITH_BACKUP) {
    const dir = path.join(ROOT, 'tmp');
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const tujuan = path.join(dir, `bot.db.backup-${stamp}.db`);
    await backupDatabase(tujuan);
    console.log(`[✔] Backup disimpan: ${path.relative(ROOT, tujuan)}`);
  }

  // Foreign key dimatikan sementara supaya urutan DELETE antar tabel tidak
  // jadi masalah. Pragma ini tidak berlaku di dalam transaction, jadi diset
  // di luar.
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      for (const t of tabel) {
        db.exec(`DELETE FROM "${t.replace(/"/g, '""')}"`);
      }
      const adaSequence = db
        .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'")
        .get();
      if (adaSequence) db.exec('DELETE FROM sqlite_sequence');
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }

  db.exec('VACUUM');
  db.pragma('wal_checkpoint(TRUNCATE)');

  const sisa = tabel.reduce((a, t) => a + hitungBaris(db, t), 0);
  if (sisa !== 0) {
    throw new Error(`Masih tersisa ${sisa} baris setelah reset.`);
  }

  console.log('');
  console.log(`[✔] ${total} baris dihapus dari ${tabel.length} tabel.`);
  console.log('[✔] Database kosong & siap untuk production (schema tetap utuh).');
  console.log('');
}

resetDatabase()
  .then(() => {
    closeDatabase();
    process.exit(process.exitCode ?? 0);
  })
  .catch((err) => {
    console.error('❌ Reset database gagal:', err.message);
    if (/SQLITE_BUSY|database is locked/i.test(String(err.message))) {
      console.error('   Database sedang dipakai. Matikan bot dulu, lalu ulangi.');
    }
    closeDatabase();
    process.exit(1);
  });
