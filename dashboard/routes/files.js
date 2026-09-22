/**
 * File manager: jelajahi, edit, upload, rename, dan hapus file di folder proyek.
 * Semua path dibatasi ke dalam folder proyek oleh safeResolve().
 */

import fs from 'fs';
import path from 'path';
import express from 'express';
import {
  HttpError,
  safeResolve,
  toRelative,
  isBinary,
  checkJsSyntax,
  backupFile,
} from '../lib/files.js';

const MAX_EDIT_SIZE = 2 * 1024 * 1024; // 2MB

const PREVIEW_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.opus': 'audio/ogg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
};

function createFilesRouter(rootDir) {
  const router = express.Router();
  const resolve = (p) => safeResolve(rootDir, p);

  router.get('/list', (req, res) => {
    const dir = resolve(req.query.path);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      throw new HttpError(404, 'Folder tidak ditemukan.');
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true }).map((entry) => {
      const full = path.join(dir, entry.name);
      let stat = null;
      try {
        stat = fs.statSync(full);
      } catch {
        // symlink rusak, dll.
      }
      return {
        name: entry.name,
        path: toRelative(rootDir, full),
        type: stat?.isDirectory() ? 'dir' : 'file',
        size: stat?.isFile() ? stat.size : null,
        mtime: stat?.mtimeMs ?? null,
      };
    });

    entries.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1,
    );
    res.json({ path: toRelative(rootDir, dir), entries });
  });

  router.get('/read', (req, res) => {
    const file = resolve(req.query.path);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      throw new HttpError(404, 'File tidak ditemukan.');
    }
    const { size } = fs.statSync(file);
    if (size > MAX_EDIT_SIZE) {
      throw new HttpError(413, 'File terlalu besar untuk diedit (maks 2MB). Gunakan download.');
    }
    const buffer = fs.readFileSync(file);
    if (isBinary(buffer)) throw new HttpError(415, 'File biner tidak bisa diedit. Gunakan download.');
    res.json({ path: toRelative(rootDir, file), content: buffer.toString('utf-8'), size });
  });

  router.put('/write', (req, res) => {
    const { path: relPath, content, force } = req.body || {};
    if (typeof content !== 'string') throw new HttpError(400, 'Konten tidak valid.');
    const file = resolve(relPath);
    if (file === rootDir) throw new HttpError(400, 'Path tidak valid.');
    if (fs.existsSync(file) && !fs.statSync(file).isFile()) {
      throw new HttpError(400, 'Path tersebut adalah folder.');
    }

    if (!force) {
      const syntaxError = checkJsSyntax(content, path.basename(file));
      if (syntaxError) return res.status(422).json({ error: 'Sintaks tidak valid', detail: syntaxError });
    }

    if (fs.existsSync(file)) backupFile(rootDir, file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    res.json({ ok: true });
  });

  router.post('/mkdir', (req, res) => {
    const dir = resolve(req.body?.path);
    if (fs.existsSync(dir)) throw new HttpError(409, 'Sudah ada file/folder dengan nama itu.');
    fs.mkdirSync(dir, { recursive: true });
    res.json({ ok: true });
  });

  router.post('/create', (req, res) => {
    const file = resolve(req.body?.path);
    if (fs.existsSync(file)) throw new HttpError(409, 'Sudah ada file/folder dengan nama itu.');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '');
    res.json({ ok: true });
  });

  router.post('/rename', (req, res) => {
    const from = resolve(req.body?.from);
    const to = resolve(req.body?.to);
    if (from === rootDir || to === rootDir) throw new HttpError(400, 'Path tidak valid.');
    if (!fs.existsSync(from)) throw new HttpError(404, 'File/folder asal tidak ditemukan.');
    if (fs.existsSync(to)) throw new HttpError(409, 'Tujuan sudah ada.');
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
    res.json({ ok: true });
  });

  router.delete('/', (req, res) => {
    const target = resolve(req.query.path);
    if (target === rootDir) throw new HttpError(400, 'Folder proyek tidak boleh dihapus.');
    if (!fs.existsSync(target)) throw new HttpError(404, 'File/folder tidak ditemukan.');
    if (fs.statSync(target).isFile()) backupFile(rootDir, target);
    fs.rmSync(target, { recursive: true, force: true });
    res.json({ ok: true });
  });

  // Upload: body mentah (bukan multipart), nama file lewat query ?dir=&name=
  router.post(
    '/upload',
    express.raw({ type: () => true, limit: '50mb' }),
    (req, res) => {
      const name = path.basename(String(req.query.name || ''));
      if (!name || name === '.' || name === '..') throw new HttpError(400, 'Nama file tidak valid.');
      const dir = resolve(req.query.dir);
      const file = resolve(path.posix.join(toRelative(rootDir, dir), name));
      if (fs.existsSync(file)) {
        if (req.query.overwrite !== '1') throw new HttpError(409, `File '${name}' sudah ada.`);
        backupFile(rootDir, file);
      }
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0));
      res.json({ ok: true, path: toRelative(rootDir, file) });
    },
  );

  // Pratinjau gambar/audio/video di browser. Sengaja dibatasi ke tipe media:
  // file HTML/SVG yang ditampilkan inline di origin dashboard bisa menjalankan
  // script dengan cookie login.
  router.get('/raw', (req, res) => {
    const file = resolve(req.query.path);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      throw new HttpError(404, 'File tidak ditemukan.');
    }
    const ext = path.extname(file).toLowerCase();
    if (!PREVIEW_TYPES[ext]) throw new HttpError(415, 'Tipe file ini tidak bisa dipratinjau.');
    res.setHeader('Cache-Control', 'no-store');
    res.type(PREVIEW_TYPES[ext]).sendFile(file);
  });

  router.get('/download', (req, res) => {
    const file = resolve(req.query.path);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      throw new HttpError(404, 'File tidak ditemukan.');
    }
    res.download(file, path.basename(file));
  });

  return router;
}

export { createFilesRouter };
