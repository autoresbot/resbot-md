/**
 * devlog.js — logging khusus development untuk migrasi Baileys -> zapo.
 *
 * Tujuannya supaya bentuk data yang lewat (pesan masuk, hasil serialize,
 * deteksi admin, keputusan handler, dan konten yang dikirim) bisa dibaca ulang
 * dari file, bukan ditebak. Perbedaan bentuk data antara Baileys dan zapo
 * adalah sumber bug paling sering di migrasi ini, dan sebagian besar gagalnya
 * DIAM — tidak ada error, cuma tidak terjadi apa-apa.
 *
 * Format: JSON Lines (satu objek JSON per baris) di `logs/dev/<kind>-<tanggal>.jsonl`
 * supaya gampang di-grep, di-tail, dan dibaca sebagian tanpa memuat semuanya.
 *
 * AKTIF saat `config.mode === 'development'` atau env `DEV_LOG=1`.
 * Saat mati, `devlog()` langsung return — nyaris tanpa biaya.
 *
 * Semua operasi di sini dibungkus try/catch: logging TIDAK BOLEH menjatuhkan
 * bot, apa pun isi datanya.
 */

import fs from 'fs';
import path from 'path';
import config from '../config.js';

const DEV_LOG_DIR = path.join(process.cwd(), 'logs', 'dev');

/** Batas ukuran per file sebelum dirotasi (5 MB). */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Potong string panjang supaya log tetap terbaca (mis. base64 media). */
const MAX_STRING = 500;

const enabled =
  process.env.DEV_LOG === '1' || String(config?.mode).toLowerCase() === 'development';

/** True kalau devlog sedang aktif — dipakai pemanggil untuk melewati kerja berat. */
export const isDevLogEnabled = () => enabled;

let dirReady = false;

function ensureDir() {
  if (dirReady) return;
  fs.mkdirSync(DEV_LOG_DIR, { recursive: true });
  dirReady = true;
}

function currentFile(kind) {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(DEV_LOG_DIR, `${kind}-${date}.jsonl`);
}

function rotateIfNeeded(file) {
  try {
    const { size } = fs.statSync(file);
    if (size < MAX_FILE_BYTES) return;
    fs.renameSync(file, `${file}.${Date.now()}.old`);
  } catch {
    // file belum ada -> tidak perlu rotasi
  }
}

/**
 * Rapikan nilai agar aman di-JSON: Buffer diringkas, string panjang dipotong,
 * dan siklus objek tidak membuat JSON.stringify meledak.
 */
function sanitize(value, seen = new WeakSet(), depth = 0) {
  if (value === null || value === undefined) return value;

  const type = typeof value;
  if (type === 'bigint') return `${value}n`;
  if (type === 'function') return '[Function]';
  if (type !== 'object') {
    if (type === 'string' && value.length > MAX_STRING) {
      return `${value.slice(0, MAX_STRING)}…(+${value.length - MAX_STRING} char)`;
    }
    return value;
  }

  if (Buffer.isBuffer(value)) return `[Buffer ${value.length} bytes]`;
  if (value instanceof Uint8Array) return `[Uint8Array ${value.length} bytes]`;
  if (value instanceof Error) return { error: value.message, stack: value.stack };

  if (seen.has(value)) return '[Circular]';
  if (depth > 6) return '[Terlalu dalam]';
  seen.add(value);

  if (Array.isArray(value)) {
    // Daftar panjang (mis. 200 peserta grup) diringkas.
    const items = value.slice(0, 30).map((v) => sanitize(v, seen, depth + 1));
    if (value.length > 30) items.push(`…(+${value.length - 30} item)`);
    return items;
  }

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = sanitize(val, seen, depth + 1);
  }
  return out;
}

/**
 * Tulis satu entri log.
 *
 * @param {string} kind  Nama berkas/kategori: 'message' | 'send' | 'admin' | 'handler' | 'group'
 * @param {object} data  Isi bebas; akan dirapikan lebih dulu.
 */
export function devlog(kind, data) {
  if (!enabled) return;

  try {
    ensureDir();
    const file = currentFile(kind);
    rotateIfNeeded(file);

    const entry = { t: new Date().toISOString(), ...sanitize(data) };
    fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch {
    // Logging tidak boleh menjatuhkan bot.
  }
}

/** Ringkas key pesan agar entri log tetap padat namun informatif. */
export function summarizeKey(key = {}) {
  return {
    remoteJid: key.remoteJid,
    remoteJidAlt: key.remoteJidAlt,
    participant: key.participant,
    participantAlt: key.participantAlt,
    fromMe: key.fromMe,
    id: key.id,
    isGroup: key.isGroup,
  };
}

export { DEV_LOG_DIR };
