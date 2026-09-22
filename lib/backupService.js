/**
 * backupService.js - Sumber tunggal logika backup ke WhatsApp.
 *
 * Dipakai bersama oleh:
 *   - Plugin .backup (plugins/OWNER/backup.js)
 *   - Fitur AUTO_BACKUP (lib/autobackup.js)
 *
 * Pembuatan file backup tetap memakai createBackup() di lib/utils.js,
 * sedangkan validasi file, penyiapan tujuan, dan pengiriman dokumen
 * dipusatkan di sini.
 *
 * Fokus utama modul ini:
 *   1. File backup divalidasi dulu (ada / tidak kosong / tidak melebihi limit WA)
 *      supaya tidak berakhir dengan "Media upload failed on all hosts".
 *   2. Upload yang gagal diulang beberapa kali dengan jeda (retry + backoff).
 *   3. Pengiriman AMAN dari risiko banned: nomor tujuan diverifikasi dulu,
 *      duplikat dibuang, jumlah tujuan dibatasi, dan ada jeda acak antar kirim.
 */

import fs from 'fs';
import moment from 'moment-timezone';
import config from '../config.js';
import { createBackup, resolveSendableJid, sleep } from './utils.js';
import { listOwner } from './users.js';
import { BackupError, STAGE, formatBytes, jelaskanErrorWa } from './backupErrors.js';

const BACKUP_FILENAME = 'autoresbot-backup.zip';
const BACKUP_MIMETYPE = 'application/zip';

// Batas aman dokumen WhatsApp. Limit resminya ~100 MB, tetapi di atas ~90 MB
// upload sangat sering ditolak semua host media.
const WA_MAX_UPLOAD = 90 * 1024 * 1024;

// Pengulangan upload bila server media WhatsApp menolak
const MAX_RETRY = 3;
const RETRY_DELAY_MS = [5000, 15000, 30000];

// Anti-banned: jeda acak antar nomor tujuan & batas jumlah tujuan per siklus
const DELAY_MIN_MS = 5000;
const DELAY_MAX_MS = 12000;
const MAX_TARGETS = 10;

/**
 * Susun caption dokumen backup (tanggal, ukuran bila tersedia, jenis backup).
 */
function buildCaption(backup, type) {
  const tanggal = moment.tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm:ss');
  const lines = ['🗄️ *Backup Data*', `📅 Tanggal : ${tanggal}`];
  if (backup?.size) lines.push(`📦 Ukuran : ${backup.size}`);
  lines.push(`🏷️ Jenis : ${type}`);
  return lines.join('\n');
}

/**
 * Pastikan file backup layak dikirim: ada, tidak kosong, tidak melebihi limit WA.
 * Dicek sebelum upload agar kegagalan ketahuan sejak awal beserta solusinya.
 */
function validateBackupFile(filePath) {
  let stats;
  try {
    stats = fs.statSync(filePath);
  } catch (err) {
    throw new BackupError(
      STAGE.CHECK,
      'File backup tidak berhasil dibuat.',
      'Pastikan folder project bisa ditulis dan ruang disk masih cukup.',
      `${err.code || 'ERR'} - ${filePath}`,
    );
  }

  if (stats.size === 0) {
    throw new BackupError(
      STAGE.CHECK,
      'File backup kosong (0 byte).',
      'Proses zip gagal. Jalankan ulang .backup, jika tetap kosong periksa izin folder project.',
      filePath,
    );
  }

  if (stats.size > WA_MAX_UPLOAD) {
    throw new BackupError(
      STAGE.CHECK,
      `Ukuran backup ${formatBytes(stats.size)} melebihi batas aman dokumen WhatsApp (${formatBytes(
        WA_MAX_UPLOAD,
      )}).`,
      'Kosongkan folder tmp/ dan logs/, hapus media besar yang tidak perlu, lalu ulangi. Untuk file besar gunakan *.backuptele*.',
      `size=${stats.size} byte`,
    );
  }

  return stats;
}

/**
 * Cek apakah JID benar-benar terdaftar di WhatsApp.
 *
 * Mencegah pengiriman ke nomor yang salah ketik / tidak aktif - selain sia-sia,
 * mengirim ke nomor tidak terdaftar berulang kali adalah pola yang dinilai
 * mencurigakan oleh WhatsApp.
 *
 * @returns {Promise<boolean>} false hanya bila WhatsApp memastikan tidak terdaftar.
 *   Bila pengecekan gagal (offline / tidak didukung), dianggap valid agar backup
 *   tetap jalan.
 */
async function isRegisteredOnWa(sock, jid) {
  try {
    const result = await sock?.onWhatsApp?.(jid);
    if (!Array.isArray(result)) return true; // tidak bisa dicek -> jangan blokir
    if (result.length === 0) return false;
    return result[0]?.exists !== false;
  } catch {
    return true; // gagal cek -> jangan blokir proses backup
  }
}

/**
 * Daftar tujuan pengiriman backup: nomor bot (opsional) + semua owner, unik.
 *
 * Tiap identifier diresolusi ke JID nomor yang valid via resolveSendableJid,
 * sehingga owner yang dikonfigurasi sebagai LID tidak menyebabkan error 401
 * (WhatsApp hanya bisa kirim ke JID nomor, bukan @lid). Setelah itu setiap
 * nomor diverifikasi ke WhatsApp supaya tidak ada pengiriman ke target salah.
 *
 * @returns {Promise<{targets:string[], invalid:string[], dibatasi:boolean}>}
 */
async function buildTargets(sock, includeBot) {
  const rawIds = [];
  if (includeBot && config.phone_number_bot) rawIds.push(config.phone_number_bot);
  for (const owner of listOwner() || []) {
    if (owner) rawIds.push(owner);
  }

  const targets = [];
  const invalid = [];

  for (const id of rawIds) {
    const jid = await resolveSendableJid(sock, id);

    if (!jid) {
      invalid.push(`${id} (tidak bisa diubah ke nomor WhatsApp)`);
      continue;
    }
    if (targets.includes(jid)) continue; // duplikat -> jangan kirim dua kali

    if (!(await isRegisteredOnWa(sock, jid))) {
      invalid.push(`${jid.split('@')[0]} (tidak terdaftar di WhatsApp)`);
      continue;
    }

    targets.push(jid);
  }

  // Batasi jumlah tujuan: backup tidak pernah butuh blast ke banyak nomor
  const dibatasi = targets.length > MAX_TARGETS;
  return { targets: dibatasi ? targets.slice(0, MAX_TARGETS) : targets, invalid, dibatasi };
}

/**
 * Apakah error ini layak dicoba ulang (kegagalan upload / jaringan sesaat)?
 */
function bolehRetry(err) {
  const pesan = String(err?.message || '').toLowerCase();
  return (
    pesan.includes('media upload failed') ||
    pesan.includes('all hosts') ||
    pesan.includes('timed out') ||
    pesan.includes('timeout') ||
    ['ETIMEDOUT', 'ECONNRESET', 'ECONNABORTED', 'EPIPE', 'EAI_AGAIN'].includes(err?.code)
  );
}

/**
 * Kirim dokumen backup ke satu nomor, dengan pengulangan bila upload gagal.
 * Sebelum retry, koneksi media disegarkan agar tidak memakai host yang sama.
 */
async function sendWithRetry(sock, jid, message) {
  let lastErr;

  for (let percobaan = 0; percobaan <= MAX_RETRY; percobaan++) {
    try {
      return await sock.sendMessage(jid, message);
    } catch (err) {
      lastErr = err;
      if (percobaan === MAX_RETRY || !bolehRetry(err)) break;

      const jeda = RETRY_DELAY_MS[percobaan] ?? RETRY_DELAY_MS[RETRY_DELAY_MS.length - 1];
      console.warn(
        `[BACKUP] Upload gagal (${err.message}). Coba ulang ${percobaan + 1}/${MAX_RETRY} dalam ${
          jeda / 1000
        }s`,
      );

      // Paksa ambil host media baru sebelum mencoba lagi
      try {
        await sock?.refreshMediaConn?.(true);
      } catch {
        // abaikan, retry tetap dijalankan
      }

      await sleep(jeda);
    }
  }

  throw lastErr;
}

/**
 * Buat file backup lalu kirim sebagai dokumen ke nomor bot & semua owner.
 *
 * @param {object} sock - socket bot
 * @param {object} [options]
 * @param {string} [options.type='Manual'] - jenis backup untuk caption
 * @param {boolean} [options.includeBot=true] - sertakan nomor bot sebagai tujuan
 * @returns {Promise<{backup:object, terkirim:string[], gagal:Array, invalid:string[], dibatasi:boolean}>}
 * @throws {BackupError} bila file backup gagal dibuat / tidak layak kirim,
 *   atau bila TIDAK ADA satu pun tujuan yang berhasil menerima backup.
 */
async function createAndSendBackup(sock, options = {}) {
  const { type = 'Manual', includeBot = true } = options;

  // 1) Buat file backup
  let backup;
  try {
    backup = await createBackup();
  } catch (err) {
    const info = jelaskanErrorWa(err, STAGE.BACKUP);
    throw new BackupError(info.stage, info.sebab, info.solusi, info.teknis);
  }

  // 2) Pastikan file layak dikirim sebelum menyentuh server media WhatsApp
  validateBackupFile(backup.path);

  // 3) Siapkan tujuan (sudah diverifikasi & unik)
  const { targets, invalid, dibatasi } = await buildTargets(sock, includeBot);

  if (targets.length === 0) {
    throw new BackupError(
      STAGE.TARGET,
      'Tidak ada nomor tujuan yang valid untuk menerima backup.',
      'Periksa DATA_OWNER di config.js - pastikan nomor/LID owner benar dan terdaftar di WhatsApp. File backup tetap tersimpan di server.',
      [`file=${backup.path}`, invalid.length ? `ditolak: ${invalid.join(', ')}` : null]
        .filter(Boolean)
        .join(' | '),
    );
  }

  const message = {
    document: { url: backup.path },
    fileName: BACKUP_FILENAME,
    mimetype: BACKUP_MIMETYPE,
    caption: buildCaption(backup, type),
  };

  // 4) Kirim satu per satu dengan jeda acak (anti-banned).
  //    Kegagalan satu tujuan tidak menghentikan tujuan lain.
  const terkirim = [];
  const gagal = [];

  for (let i = 0; i < targets.length; i++) {
    const jid = targets[i];

    if (i > 0) {
      const jeda = Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS)) + DELAY_MIN_MS;
      await sleep(jeda);
    }

    try {
      await sendWithRetry(sock, jid, message);
      terkirim.push(jid);
    } catch (err) {
      const info = jelaskanErrorWa(err, STAGE.UPLOAD);
      gagal.push({ jid, ...info });
      console.error(`[BACKUP] Gagal kirim ke ${jid}: ${info.sebab}`);
    }
  }

  // 5) Semua tujuan gagal -> laporkan sebagai error dengan penyebab aslinya
  if (terkirim.length === 0) {
    const utama = gagal[0];
    throw new BackupError(
      utama?.stage || STAGE.UPLOAD,
      utama?.sebab || 'Backup gagal terkirim ke semua nomor tujuan.',
      utama?.solusi || 'Ulangi .backup saat koneksi stabil. File backup tetap tersimpan di server.',
      [utama?.teknis, `file=${backup.path}`].filter(Boolean).join(' | '),
    );
  }

  return { backup, terkirim, gagal, invalid, dibatasi };
}

export { createAndSendBackup, validateBackupFile, WA_MAX_UPLOAD };
