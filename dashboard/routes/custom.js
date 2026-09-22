/**
 * Custom: ganti gambar menu (database/assets/allmenu.jpg) dan audio sapaan
 * (database/audio/*.opus). Bot membaca file-file ini setiap kali dipakai,
 * jadi perubahan langsung berlaku tanpa restart.
 *
 * Upload apa pun dikonversi ke format yang dipakai bot:
 *  - gambar (PNG/WebP/GIF/JPG) => JPEG lewat sharp
 *  - audio (MP3/M4A/WAV/OGG/...) => Opus lewat ffmpeg (sudah terpasang untuk sticker)
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import express from 'express';
import { HttpError, backupFile } from '../lib/files.js';

const AUDIO_SLOTS = ['pagi', 'siang', 'sore', 'petang', 'malam', 'sahur'];
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_AUDIO = 20 * 1024 * 1024;

const isJpeg = (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const isImage = (b) =>
  isJpeg(b) ||
  b.subarray(0, 4).toString('hex') === '89504e47' || // PNG
  (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') ||
  b.subarray(0, 3).toString() === 'GIF';
// Ogg berisi Opus: header "OggS" dan penanda "OpusHead" di halaman pertama.
const isOggOpus = (b) => b.subarray(0, 4).toString() === 'OggS' && b.subarray(0, 200).includes('OpusHead');

async function toJpeg(buffer) {
  if (isJpeg(buffer)) return buffer;
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    throw new HttpError(415, 'Konversi gambar tidak tersedia di server ini. Upload file JPG.');
  }
  try {
    return await sharp(buffer, { animated: false }).flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer();
  } catch {
    throw new HttpError(415, 'Gambar tidak bisa dibaca.');
  }
}

async function getFfmpegPath() {
  try {
    return (await import('@ffmpeg-installer/ffmpeg')).default.path;
  } catch {
    return 'ffmpeg'; // pakai ffmpeg sistem kalau ada
  }
}

/** Konversi audio apa pun ke Ogg Opus mono (format voice note WhatsApp). */
async function toOpus(buffer) {
  if (isOggOpus(buffer)) return buffer;

  const id = crypto.randomBytes(6).toString('hex');
  const input = path.join(os.tmpdir(), `resbot-audio-${id}`);
  const output = path.join(os.tmpdir(), `resbot-audio-${id}.opus`);
  fs.writeFileSync(input, buffer);

  try {
    const ffmpeg = await getFfmpegPath();
    await new Promise((resolve, reject) => {
      const proc = spawn(ffmpeg, [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-i', input,
        '-vn', '-ac', '1', '-ar', '48000',
        '-c:a', 'libopus', '-b:a', '64k',
        output,
      ]);
      let stderr = '';
      proc.stderr.on('data', (d) => (stderr += d));
      proc.on('error', reject);
      proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(stderr.trim()))));
      setTimeout(() => proc.kill('SIGKILL'), 60000);
    });
    return fs.readFileSync(output);
  } catch {
    throw new HttpError(415, 'File audio tidak bisa dikonversi. Coba MP3, M4A, WAV, atau OPUS.');
  } finally {
    fs.rmSync(input, { force: true });
    fs.rmSync(output, { force: true });
  }
}

function fileInfo(file) {
  try {
    const stat = fs.statSync(file);
    return { exists: true, size: stat.size, mtime: stat.mtimeMs };
  } catch {
    return { exists: false, size: 0, mtime: null };
  }
}

function createCustomRouter(rootDir) {
  const router = express.Router();
  const imageFile = path.join(rootDir, 'database', 'assets', 'allmenu.jpg');
  const audioDir = path.join(rootDir, 'database', 'audio');
  const audioFile = (slot) => path.join(audioDir, `${slot}.opus`);

  const replaceFile = (file, buffer) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file)) backupFile(rootDir, file);
    fs.writeFileSync(file, buffer);
  };

  router.get('/', (req, res) => {
    res.json({
      image: fileInfo(imageFile),
      audio: AUDIO_SLOTS.map((slot) => ({ slot, ...fileInfo(audioFile(slot)) })),
    });
  });

  router.get('/image', (req, res) => {
    if (!fs.existsSync(imageFile)) throw new HttpError(404, 'Gambar menu belum ada.');
    res.setHeader('Cache-Control', 'no-store');
    res.type('image/jpeg').sendFile(imageFile);
  });

  router.post('/image', express.raw({ type: () => true, limit: MAX_IMAGE }), async (req, res) => {
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!isImage(buffer)) throw new HttpError(415, 'File bukan gambar (JPG, PNG, WebP, atau GIF).');
    replaceFile(imageFile, await toJpeg(buffer));
    res.json({ ok: true, image: fileInfo(imageFile) });
  });

  router.get('/audio/:slot', (req, res) => {
    const { slot } = req.params;
    if (!AUDIO_SLOTS.includes(slot)) throw new HttpError(404, 'Audio tidak dikenal.');
    if (!fs.existsSync(audioFile(slot))) throw new HttpError(404, 'Audio belum ada.');
    res.setHeader('Cache-Control', 'no-store');
    res.type('audio/ogg').sendFile(audioFile(slot));
  });

  // ?target=all atau salah satu slot (pagi, siang, ...)
  router.post('/audio', express.raw({ type: () => true, limit: MAX_AUDIO }), async (req, res) => {
    const target = String(req.query.target || '');
    const slots = target === 'all' ? AUDIO_SLOTS : AUDIO_SLOTS.filter((s) => s === target);
    if (!slots.length) throw new HttpError(400, 'Pilih audio yang akan diganti.');

    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (buffer.length < 100) throw new HttpError(400, 'File audio kosong.');

    const opus = await toOpus(buffer);
    for (const slot of slots) replaceFile(audioFile(slot), opus);
    res.json({ ok: true, replaced: slots });
  });

  return router;
}

export { createCustomRouter, AUDIO_SLOTS };
