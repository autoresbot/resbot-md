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
 * Menulis ke salah satu file log di folder /logs.
 * Tidak pernah melempar error (defensive programming).
 */
function appendLog(filename, content) {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    fs.appendFileSync(path.join(LOG_DIR, filename), content);
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
