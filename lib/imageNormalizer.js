/**
 * imageNormalizer.js - Pastikan file gambar benar-benar berformat yang diterima
 * server uploader.
 *
 * LATAR BELAKANG
 * --------------
 * `getMediaExtension()` di lib/utils.js SELALU memberi ekstensi `.jpg` untuk
 * setiap `imageMessage` WhatsApp:
 *
 *     case 'image':
 *       return '.jpg';
 *
 * Padahal isi aslinya bisa saja WebP, PNG, atau GIF (gambar hasil forward,
 * stiker yang dikirim sebagai gambar, screenshot dari sebagian klien).
 * Akibatnya file bernama `.jpg` tapi byte-nya bukan JPEG. Saat diunggah,
 * `form-data` ikut mendeklarasikan `Content-Type: image/jpeg` berdasarkan
 * ekstensi, lalu server memeriksa isi file yang ternyata tidak cocok dan
 * menolak dengan:
 *
 *     { status: false, message: 'Isi file tidak sesuai dengan format yang diizinkan.' }
 *
 * SOLUSI
 * ------
 * Deteksi format SEBENARNYA dari magic bytes, lalu:
 *   - JPEG / PNG  -> dipakai apa adanya (sudah diterima server), hanya
 *                    ekstensi & content-type-nya yang dibetulkan.
 *   - Format lain -> dikonversi menjadi JPEG.
 *
 * Konversi memakai jimp lebih dulu (pure JS, tanpa proses tambahan). Jimp 1.6
 * HANYA mendukung bmp/gif/jpeg/png/tiff — WebP tidak didukung — sehingga
 * ffmpeg dipakai sebagai fallback karena mampu membaca WebP dan format lain.
 */

import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

// Format yang diterima apa adanya oleh server uploader.
const PASSTHROUGH = new Set(['jpeg', 'png']);

const MIME_BY_FORMAT = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  heic: 'image/heic',
};

const EXT_BY_FORMAT = {
  jpeg: '.jpg',
  png: '.png',
  webp: '.webp',
  gif: '.gif',
  bmp: '.bmp',
  tiff: '.tiff',
  heic: '.heic',
};

/**
 * Deteksi format gambar dari magic bytes (bukan dari ekstensi file, karena
 * ekstensi dari WhatsApp tidak bisa dipercaya).
 *
 * @param {Buffer} buf
 * @returns {string|null} 'jpeg' | 'png' | 'webp' | 'gif' | 'bmp' | 'tiff' | 'heic' | null
 */
function detectImageFormat(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'png';
  }

  // WebP: "RIFF" ....(4 byte ukuran).... "WEBP"
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }

  // GIF: "GIF87a" / "GIF89a"
  if (buf.toString('ascii', 0, 3) === 'GIF') return 'gif';

  // BMP: "BM"
  if (buf[0] === 0x42 && buf[1] === 0x4d) return 'bmp';

  // TIFF: "II*\0" (little endian) atau "MM\0*" (big endian)
  if (
    (buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0x00) ||
    (buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00 && buf[3] === 0x2a)
  ) {
    return 'tiff';
  }

  // HEIC/HEIF: box "ftyp" di offset 4, diikuti brand
  if (buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    if (['heic', 'heix', 'hevc', 'mif1', 'msf1'].includes(brand)) return 'heic';
  }

  return null;
}

/**
 * Konversi ke JPEG memakai jimp. Hanya sanggup untuk bmp/gif/jpeg/png/tiff.
 */
async function convertWithJimp(buf) {
  const { Jimp } = await import('jimp');
  const image = await Jimp.read(buf);
  return await image.getBuffer('image/jpeg', { quality: 90 });
}

/**
 * Konversi ke JPEG memakai ffmpeg. Dipakai untuk WebP (tidak didukung jimp)
 * dan format lain yang gagal dibaca jimp.
 */
async function convertWithFfmpeg(buf, sourceFormat) {
  const { default: ffmpegInstaller } = await import('@ffmpeg-installer/ffmpeg');
  const ffmpegPath = ffmpegInstaller?.path;
  if (!ffmpegPath) throw new Error('ffmpeg tidak tersedia');

  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const inPath = path.join(os.tmpdir(), `imgnorm_${stamp}${EXT_BY_FORMAT[sourceFormat] || '.bin'}`);
  const outPath = path.join(os.tmpdir(), `imgnorm_${stamp}.jpg`);

  try {
    await fsp.writeFile(inPath, buf);

    await new Promise((resolve, reject) => {
      // -frames:v 1 -> ambil frame pertama saja (penting untuk WebP/GIF animasi)
      const proc = spawn(
        ffmpegPath,
        ['-y', '-loglevel', 'error', '-i', inPath, '-frames:v', '1', '-q:v', '2', outPath],
        { windowsHide: true },
      );

      let stderr = '';
      proc.stderr?.on('data', (d) => {
        stderr += d.toString();
      });

      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr.trim().split('\n').pop() || `ffmpeg keluar dengan kode ${code}`));
      });
    });

    return await fsp.readFile(outPath);
  } finally {
    // Bersihkan file sementara; kegagalan hapus tidak boleh menjatuhkan proses.
    await fsp.rm(inPath, { force: true }).catch(() => {});
    await fsp.rm(outPath, { force: true }).catch(() => {});
  }
}

/**
 * Normalisasi buffer gambar agar pasti diterima server uploader.
 *
 * @param {Buffer} buffer - isi file gambar
 * @returns {Promise<{buffer: Buffer, format: string, ext: string, mime: string, detected: string|null, converted: boolean}>}
 * @throws {Error} bila isi file bukan gambar yang dikenali / gagal dikonversi
 */
async function normalizeImageBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('File gambar kosong');
  }

  const detected = detectImageFormat(buffer);

  // Sudah format yang diterima server -> pakai apa adanya.
  if (detected && PASSTHROUGH.has(detected)) {
    return {
      buffer,
      format: detected,
      ext: EXT_BY_FORMAT[detected],
      mime: MIME_BY_FORMAT[detected],
      detected,
      converted: false,
    };
  }

  if (!detected) {
    throw new Error('Isi file bukan gambar yang dikenali');
  }

  // Butuh konversi: jimp dulu, ffmpeg sebagai cadangan.
  let converted = null;
  try {
    converted = await convertWithJimp(buffer);
  } catch {
    converted = await convertWithFfmpeg(buffer, detected);
  }

  if (!converted || converted.length === 0) {
    throw new Error(`Gagal mengonversi ${detected} ke JPEG`);
  }

  return {
    buffer: converted,
    format: 'jpeg',
    ext: '.jpg',
    mime: 'image/jpeg',
    detected,
    converted: true,
  };
}

/**
 * Versi yang membaca langsung dari path file.
 */
async function normalizeImageFile(filePath) {
  const buffer = await fsp.readFile(filePath);
  return normalizeImageBuffer(buffer);
}

/**
 * Sama seperti normalizeImageBuffer, TAPI TANPA konversi — isi file dibiarkan
 * apa adanya, hanya ekstensi & content-type-nya yang dibetulkan agar cocok
 * dengan isi sebenarnya.
 *
 * Dipakai oleh fitur yang formatnya memang harus dipertahankan, misalnya:
 *   - /api/convert/webptovideo  (tovid/togif) -> WAJIB tetap WebP
 *   - /api/convert/giftoimage   (toimg)       -> WAJIB tetap WebP/GIF
 * Mengonversi input ke JPEG lebih dulu akan merusak fitur-fitur tersebut.
 *
 * @returns {{buffer: Buffer, format: string, ext: string, mime: string, detected: string, converted: false}}
 */
function describeImageBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('File gambar kosong');
  }

  const detected = detectImageFormat(buffer);
  if (!detected) {
    throw new Error('Isi file bukan gambar yang dikenali');
  }

  return {
    buffer,
    format: detected,
    ext: EXT_BY_FORMAT[detected],
    mime: MIME_BY_FORMAT[detected],
    detected,
    converted: false,
  };
}

async function describeImageFile(filePath) {
  const buffer = await fsp.readFile(filePath);
  return describeImageBuffer(buffer);
}

export {
  detectImageFormat,
  normalizeImageBuffer,
  normalizeImageFile,
  describeImageBuffer,
  describeImageFile,
};
