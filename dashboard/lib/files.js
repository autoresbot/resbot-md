/**
 * files.js - Helper file untuk dashboard: pengaman path, cek sintaks, backup.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';

const MAX_BACKUPS = 30;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Ubah path relatif dari browser menjadi path absolut yang DIJAMIN masih di
 * dalam folder proyek (menolak ../, path absolut, dan symlink keluar proyek).
 */
function safeResolve(rootDir, relPath = '') {
  const cleaned = String(relPath).replace(/\\/g, '/').replace(/^\/+/, '');
  const target = path.resolve(rootDir, cleaned);
  const inside = (p) => p === rootDir || p.startsWith(rootDir + path.sep);

  if (!inside(target)) throw new HttpError(400, 'Path di luar folder proyek.');

  // Untuk path yang sudah ada, pastikan juga tujuan aslinya (symlink) di dalam proyek.
  if (fs.existsSync(target)) {
    const real = fs.realpathSync(target);
    if (!inside(real) && real !== fs.realpathSync(rootDir)) {
      throw new HttpError(400, 'Path di luar folder proyek.');
    }
  }
  return target;
}

function toRelative(rootDir, absPath) {
  return path.relative(rootDir, absPath).split(path.sep).join('/');
}

/** Heuristik sederhana: file dianggap biner kalau ada byte NUL di 8KB pertama. */
function isBinary(buffer) {
  const len = Math.min(buffer.length, 8192);
  for (let i = 0; i < len; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

/**
 * Cek sintaks file JavaScript TANPA menjalankannya (node --check).
 * File uji ditulis ke folder temp sistem, bukan ke folder proyek, supaya
 * tidak terbaca oleh pemantau plugin.
 * @returns {string|null} pesan error, atau null jika valid
 */
function checkJsSyntax(content, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (!['.js', '.mjs', '.cjs'].includes(ext)) return null;

  // package.json proyek memakai "type": "module", jadi .js = ES module.
  const tmpExt = ext === '.cjs' ? '.cjs' : '.mjs';
  const tmpFile = path.join(
    os.tmpdir(),
    `resbot-check-${crypto.randomBytes(6).toString('hex')}${tmpExt}`,
  );

  try {
    fs.writeFileSync(tmpFile, content);
    const result = spawnSync(process.execPath, ['--check', tmpFile], {
      encoding: 'utf-8',
      timeout: 15000,
    });
    if (result.status === 0) return null;
    // Buang stack internal node & baris versi, sisakan lokasi + pesan error.
    return (result.stderr || 'Sintaks tidak valid.')
      .split(tmpFile)
      .join(fileName)
      .split(/\r?\n/)
      .filter((line) => !/^\s+at /.test(line) && !/^Node\.js v/.test(line))
      .join('\n')
      .trim();
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }
}

/**
 * Simpan salinan file sebelum ditimpa/dihapus ke database/_dashboard_backup.
 * Hanya menyimpan MAX_BACKUPS terbaru.
 */
function backupFile(rootDir, absPath) {
  try {
    const stat = fs.statSync(absPath);
    if (!stat.isFile() || stat.size > 5 * 1024 * 1024) return;

    const backupDir = path.join(rootDir, 'database', '_dashboard_backup');
    fs.mkdirSync(backupDir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = `${stamp}__${toRelative(rootDir, absPath).replace(/[\\/]/g, '__')}`;
    fs.copyFileSync(absPath, path.join(backupDir, name));

    const backups = fs.readdirSync(backupDir).sort();
    for (const old of backups.slice(0, Math.max(0, backups.length - MAX_BACKUPS))) {
      fs.rmSync(path.join(backupDir, old), { force: true });
    }
  } catch {
    // Backup gagal tidak boleh menggagalkan penyimpanan.
  }
}

/**
 * Tulis modul JS di root proyek (config.js, strings.js) dengan aman: cek
 * sintaks, pastikan export default masih ada, backup versi lama, baru ditulis.
 * Melempar HttpError 422 jika tidak valid.
 */
function writeModuleFile(rootDir, fileName, content) {
  const file = path.join(rootDir, fileName);
  const syntaxError = checkJsSyntax(content, fileName);
  if (syntaxError) throw new HttpError(422, `${fileName} tidak valid:\n${syntaxError}`);
  if (!/export\s+default/.test(content)) {
    throw new HttpError(422, `${fileName} harus tetap memiliki "export default".`);
  }
  backupFile(rootDir, file);
  fs.writeFileSync(file, content);
}

const writeConfigFile = (rootDir, content) => writeModuleFile(rootDir, 'config.js', content);

export {
  HttpError,
  safeResolve,
  toRelative,
  isBinary,
  checkJsSyntax,
  backupFile,
  writeConfigFile,
  writeModuleFile,
};
