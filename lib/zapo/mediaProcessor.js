/**
 * Media processor untuk zapo-js: pembuat thumbnail (preview) pesan media.
 *
 * WhatsApp menampilkan gambar/video kecil yang blur SEBELUM medianya diunduh
 * penerima. Gambar itu bukan hasil unduhan, melainkan `jpegThumbnail` yang ikut
 * dikirim di dalam pesan. Baileys membuatnya sendiri; zapo TIDAK — ia hanya
 * menyediakan antarmuka `WaMediaProcessor` dan memakainya kalau diisi
 * (lihat `shouldGenerateThumbnail` di zapo-js/dist/client/media.js).
 *
 * Karena bot belum pernah mengisinya, semua gambar/video terkirim tanpa
 * thumbnail sehingga previewnya kosong/abu-abu sampai penerima menekan unduh.
 * Modul ini yang mengisinya.
 *
 * `sharp` dipakai lebih dulu (cepat, sudah jadi dependency), `jimp` sebagai
 * cadangan karena `sharp` modul native yang kadang gagal dimuat di panel.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import ff from 'fluent-ffmpeg';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';

ff.setFfmpegPath(ffmpegPath);

/** Mutu jpeg thumbnail — kecil saja, ikut dikirim di dalam badan pesan. */
const MUTU_JPEG = 60;

const fileSementara = (ext) =>
  path.join(os.tmpdir(), `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.${ext}`);

/** zapo mengirim path berkas atau bytes; keduanya diseragamkan jadi Buffer. */
function keBuffer(input) {
  if (typeof input === 'string') return fs.readFileSync(input);
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  return null;
}

let sharpModule;
async function muatSharp() {
  if (sharpModule !== undefined) return sharpModule;
  try {
    sharpModule = (await import('sharp')).default;
  } catch {
    sharpModule = null; // modul native gagal dimuat -> pakai jimp
  }
  return sharpModule;
}

/**
 * Perkecil gambar menjadi thumbnail.
 *
 * @returns {Promise<{data: Buffer, width: number, height: number}|null>}
 *   `width`/`height` adalah ukuran gambar ASLI (itu yang dipakai WhatsApp untuk
 *   menentukan rasio kotak preview), bukan ukuran thumbnail-nya.
 */
async function perkecil(buffer, maxEdge, format) {
  const sharp = await muatSharp();

  if (sharp) {
    const gambar = sharp(buffer, { animated: false });
    const { width, height } = await gambar.metadata();
    const kecil = gambar.resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true });
    const data =
      format === 'png'
        ? await kecil.png().toBuffer()
        : await kecil.jpeg({ quality: MUTU_JPEG }).toBuffer();
    return { data, width: width ?? 0, height: height ?? 0 };
  }

  const { Jimp } = await import('jimp');
  const gambar = await Jimp.read(buffer);
  const { width, height } = gambar.bitmap;
  const skala = Math.min(maxEdge / width, maxEdge / height, 1);
  const salinan = gambar.clone().resize({
    w: Math.max(1, Math.round(width * skala)),
    h: Math.max(1, Math.round(height * skala)),
  });
  const data = await salinan.getBuffer(format === 'png' ? 'image/png' : 'image/jpeg', {
    quality: MUTU_JPEG,
  });
  return { data: Buffer.from(data), width, height };
}

/** Ambil satu frame video sebagai PNG untuk dijadikan thumbnail. */
async function frameVideo(input) {
  const sumber = typeof input === 'string' ? input : fileSementara('mp4');
  const hasil = fileSementara('png');
  let sumberSementara = false;

  if (typeof input !== 'string') {
    const buffer = keBuffer(input);
    if (!buffer) return null;
    fs.writeFileSync(sumber, buffer);
    sumberSementara = true;
  }

  try {
    await new Promise((resolve, reject) => {
      ff(sumber)
        .on('error', reject)
        .on('end', () => resolve(true))
        // Frame pertama sering hitam polos; detik ke-1 lebih mewakili isinya.
        .outputOptions(['-ss', '00:00:01', '-frames:v', '1'])
        .save(hasil);
    });
    return fs.readFileSync(hasil);
  } finally {
    for (const berkas of [hasil, sumberSementara ? sumber : null]) {
      if (berkas && fs.existsSync(berkas)) {
        try {
          fs.unlinkSync(berkas);
        } catch {
          // berkas sementara gagal dihapus — tidak perlu menggagalkan kiriman
        }
      }
    }
  }
}

/**
 * @returns {import('zapo-js').WaMediaProcessor}
 */
export function createMediaProcessor() {
  return {
    generateImageThumbnail: async (input, maxEdge) => {
      const buffer = keBuffer(input);
      if (!buffer) return null;
      const kecil = await perkecil(buffer, maxEdge, 'jpeg');
      if (!kecil) return null;
      return { jpegThumbnail: kecil.data, width: kecil.width, height: kecil.height };
    },

    generateVideoThumbnail: async (input, maxEdge) => {
      const frame = await frameVideo(input);
      if (!frame) return null;
      const kecil = await perkecil(frame, maxEdge, 'jpeg');
      if (!kecil) return null;
      return { jpegThumbnail: kecil.data, width: kecil.width, height: kecil.height };
    },

    generateStickerThumbnail: async (input, maxEdge) => {
      const buffer = keBuffer(input);
      if (!buffer) return null;
      const kecil = await perkecil(buffer, maxEdge, 'png');
      if (!kecil) return null;
      return { pngThumbnail: kecil.data, width: kecil.width, height: kecil.height };
    },
  };
}

/**
 * Thumbnail siap pakai untuk pesan yang dirakit SENDIRI sebagai proto mentah
 * (mis. `interactiveMessage` di menu) — jalur itu tidak lewat media processor
 * zapo, jadi harus diisi manual.
 *
 * @returns {Promise<Buffer|null>} `null` bila gambarnya tidak bisa diproses;
 *   pemanggil cukup mengirim tanpa thumbnail seperti sebelumnya.
 */
export async function buatThumbnailJpeg(media, maxEdge = 100) {
  try {
    const buffer = keBuffer(media);
    if (!buffer) return null;
    const kecil = await perkecil(buffer, maxEdge, 'jpeg');
    return kecil?.data ?? null;
  } catch (error) {
    console.warn('[THUMBNAIL] Gagal membuat preview:', error?.message || error);
    return null;
  }
}
