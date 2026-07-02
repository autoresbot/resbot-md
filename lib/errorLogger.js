/**
 * errorLogger.js - Global Error Logger
 *
 * FIX: Tambahkan error logger global yang menulis ke folder /logs
 * dengan format yang mudah diaudit (error.log, handler.log, api.log).
 *
 * Helper ini bersifat defensif: tidak boleh melempar error sendiri,
 * sehingga aman dipanggil dari mana saja (handler, plugin, global catcher).
 */

import fs from 'fs';
import path from 'path';

const LOG_DIR = path.resolve(process.cwd(), 'logs');

// ─── Batas ukuran & rotasi log ───────────────────────────────
// FIX: Cegah error.log membengkak sampai ber-giga-giga.
// - Setiap file log dibatasi MAX_LOG_SIZE. Saat terlampaui, file dirotasi
//   (error.log -> error.log.1 -> error.log.2 ...) dan yang paling lama dibuang.
// - Bisa diatur via env: LOG_MAX_MB (ukuran per file) & LOG_MAX_FILES (jumlah backup).
const MAX_LOG_MB = Math.max(1, Number(process.env.LOG_MAX_MB) || 5); // default 5 MB / file
const MAX_LOG_SIZE = MAX_LOG_MB * 1024 * 1024;
const MAX_LOG_FILES = Math.max(1, Number(process.env.LOG_MAX_FILES) || 3); // jumlah file backup

// Pastikan folder logs tersedia (sekali saat modul di-load)
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
} catch {
  // abaikan, akan dicoba lagi saat menulis
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function safeStr(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.stack || value.message || String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Rotasi file log jika ukurannya sudah melampaui MAX_LOG_SIZE.
 *
 * Skema: error.log -> error.log.1 -> error.log.2 -> ... -> dibuang.
 * Sehingga total pemakaian disk maksimal ~= MAX_LOG_SIZE * (MAX_LOG_FILES + 1).
 */
function rotateIfNeeded(fullPath) {
  try {
    const stat = fs.statSync(fullPath);
    if (stat.size < MAX_LOG_SIZE) return;

    // Buang backup paling lama, lalu geser sisanya (.n-1 -> .n)
    const oldest = `${fullPath}.${MAX_LOG_FILES}`;
    if (fs.existsSync(oldest)) fs.rmSync(oldest, { force: true });

    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
      const src = `${fullPath}.${i}`;
      const dst = `${fullPath}.${i + 1}`;
      if (fs.existsSync(src)) fs.renameSync(src, dst);
    }

    // File aktif -> .1
    fs.renameSync(fullPath, `${fullPath}.1`);
  } catch (e) {
    if (e?.code !== 'ENOENT') {
      console.error('[ERROR_LOGGER] Gagal rotasi log:', e?.message);
    }
  }
}

// ─── Throttle error identik yang berulang ────────────────────
// FIX: Cegah loop error (mis. uncaughtException berulang tiap ms) membanjiri log.
// Blok yang isinya sama & terjadi dalam jendela THROTTLE_MS akan dilewati,
// lalu diringkas jumlahnya saat error berbeda muncul / jendela berakhir.
const THROTTLE_MS = 5000; // 5 detik
const lastWrite = new Map(); // filename -> { sig, ts, skipped }

function signature(content) {
  // Ambil ~200 char pertama sebagai sidik jari blok (tanpa timestamp baris pertama)
  const body = content.replace(/^\[[^\]]*\]\s*/, '');
  return body.slice(0, 200);
}

/**
 * Menulis ke salah satu file log di folder /logs.
 * Tidak pernah melempar error (defensive programming).
 */
function appendLog(filename, content) {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    const fullPath = path.join(LOG_DIR, filename);

    // Throttle blok error identik yang berulang cepat
    const sig = signature(content);
    const now = Date.now();
    const prev = lastWrite.get(filename);
    if (prev && prev.sig === sig && now - prev.ts < THROTTLE_MS) {
      prev.skipped += 1;
      prev.ts = now;
      return;
    }

    let finalContent = content;
    if (prev && prev.skipped > 0) {
      finalContent =
        `[${timestamp()}] (error identik sebelumnya diulang ${prev.skipped}x, ` +
        `disingkat)\n\n` +
        content;
    }
    lastWrite.set(filename, { sig, ts: now, skipped: 0 });

    rotateIfNeeded(fullPath);
    fs.appendFileSync(fullPath, finalContent);
  } catch (e) {
    // Fallback ke console agar tidak menghilang begitu saja
    console.error('[ERROR_LOGGER] Gagal menulis log:', e?.message);
  }
}

/**
 * Format blok error yang konsisten & mudah diaudit.
 *
 * meta: { plugin, command, user, group, ... }
 */
function formatBlock(error, meta = {}) {
  const err = error instanceof Error ? error : null;
  const lines = [
    `[${timestamp()}]`,
    '',
    `PLUGIN  : ${safeStr(meta.plugin)}`,
    `COMMAND : ${safeStr(meta.command)}`,
    `USER    : ${safeStr(meta.user || meta.sender)}`,
    `GROUP   : ${safeStr(meta.group || meta.remoteJid)}`,
  ];

  // Sertakan field tambahan bila ada
  for (const [key, val] of Object.entries(meta)) {
    if (['plugin', 'command', 'user', 'sender', 'group', 'remoteJid'].includes(key)) continue;
    lines.push(`${key.toUpperCase()} : ${safeStr(val)}`);
  }

  lines.push('');
  lines.push(`ERROR   :`);
  lines.push(safeStr(err ? err.message : error, String(error)));
  lines.push('');
  lines.push('STACK   :');
  lines.push(safeStr(err ? err.stack : '-'));
  lines.push('');
  lines.push('----------------------------------------');
  lines.push('');

  return lines.join('\n');
}

/**
 * Log error umum -> logs/error.log
 */
function logError(error, meta = {}) {
  appendLog('error.log', formatBlock(error, meta));
}

/**
 * Log error pada handler -> logs/handler.log
 */
function logHandlerError(error, meta = {}) {
  appendLog('handler.log', formatBlock(error, meta));
}

/**
 * Log error / aktivitas API -> logs/api.log
 */
function logApiError(error, meta = {}) {
  appendLog('api.log', formatBlock(error, meta));
}

/**
 * Log baris singkat (mis. untuk retry) ke file tertentu.
 */
function logLine(filename, message) {
  appendLog(filename, `[${timestamp()}] ${safeStr(message)}\n`);
}

export { logError, logHandlerError, logApiError, logLine, LOG_DIR };
