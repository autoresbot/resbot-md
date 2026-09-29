/**
 * sapaanMedia.js - Deteksi & penyimpanan media untuk .setwelcome / .setleft
 *
 * Admin tidak perlu menyebut "foto" atau "video": cukup balas (atau kirim)
 * fotonya sambil mengetik perintah, dan bot menentukan sendiri jenisnya.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import ff from 'fluent-ffmpeg';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import ApiAutoresbotModule from 'api-autoresbot';
import config from '../config.js';
import { downloadQuotedMedia, downloadMedia, deleteMedia } from './utils.js';
import { normalizeImageBuffer } from './imageNormalizer.js';
import { uploadImageFile } from './uploader.js';

const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

ff.setFfmpegPath(ffmpegPath);

const MEDIA_DIR = path.join(process.cwd(), 'database', 'media');

/**
 * Apakah WebP ini animasi (stiker gerak)?
 *
 * Penting: ffmpeg bawaan proyek TIDAK bisa membaca WebP animasi — hasilnya
 * "Error marking filters as finished". Jadi stiker gerak harus lewat jalur
 * lain (diubah ke video), bukan lewat konversi gambar biasa.
 */
function webpAnimasi(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return false;
  if (buffer.subarray(0, 4).toString('ascii') !== 'RIFF') return false;
  if (buffer.subarray(8, 12).toString('ascii') !== 'WEBP') return false;

  // Chunk ANIM/ANMF ada di awal file; 4KB pertama sudah lebih dari cukup.
  const awal = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('latin1');
  return awal.includes('ANIM') || awal.includes('ANMF');
}

const fileSementara = (ext) =>
  path.join(os.tmpdir(), `sapaan_${crypto.randomBytes(6).toString('hex')}.${ext}`);

/**
 * WebP animasi -> mp4, dikerjakan sendiri di server.
 *
 * ffmpeg tidak bisa membaca WebP animasi (lihat catatan webpAnimasi di atas),
 * tapi `sharp` bisa. Jadi stikernya diubah dulu jadi GIF lewat sharp, baru
 * ffmpeg mengubah GIF itu jadi mp4 — format yang dikirim WhatsApp sebagai
 * video berulang (gifPlayback).
 */
async function webpAnimasiKeMp4(isiWebp) {
  const sharp = (await import('sharp')).default;
  const gif = await sharp(isiWebp, { animated: true }).gif().toBuffer();
  if (!gif?.length) throw new Error('hasil konversi ke gif kosong');

  const berkasGif = fileSementara('gif');
  const berkasMp4 = fileSementara('mp4');
  fs.writeFileSync(berkasGif, gif);

  try {
    await new Promise((resolve, reject) => {
      ff(berkasGif)
        .on('error', reject)
        .on('end', () => resolve(true))
        // yuv420p supaya bisa diputar di semua HP; codec itu menuntut
        // lebar & tinggi genap, jadi ukurannya dibulatkan ke bawah.
        .outputOptions([
          '-movflags',
          'faststart',
          '-pix_fmt',
          'yuv420p',
          '-vf',
          'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        ])
        .save(berkasMp4);
    });

    const hasil = fs.readFileSync(berkasMp4);
    if (!hasil.length) throw new Error('hasil konversi ke mp4 kosong');
    return hasil;
  } finally {
    for (const berkas of [berkasGif, berkasMp4]) {
      try {
        fs.unlinkSync(berkas);
      } catch {
        // berkas sementara sudah hilang — tidak perlu menggagalkan apa pun
      }
    }
  }
}

/**
 * Stiker gerak -> video mp4.
 *
 * Dulu langkah ini SELALU lewat API konversi autoresbot. Kalau API-nya
 * menolak (apikey kosong/habis kuota/endpoint bermasalah), .setwelcome dengan
 * stiker gerak gagal total dengan "Bad Request: Unknown error". Sekarang
 * konversinya dikerjakan sendiri, dan API hanya jadi cadangan kalau `sharp`
 * tidak bisa dimuat — modul native yang kadang gagal dipasang di panel.
 */
async function stikerGerakKeVideo(namaFile) {
  const asal = path.join(MEDIA_DIR, namaFile);
  const fileBaru = `${path.parse(namaFile).name}.mp4`;
  const tujuan = path.join(MEDIA_DIR, fileBaru);

  try {
    fs.writeFileSync(tujuan, await webpAnimasiKeMp4(fs.readFileSync(asal)));
    return fileBaru;
  } catch (error) {
    console.warn(
      '[SAPAAN] Konversi stiker di server gagal, mencoba lewat API:',
      error?.message || error,
    );
  }

  const url = await uploadImageFile(asal, {
    convert: false, // endpoint ini justru BUTUH WebP aslinya
    label: 'SAPAAN',
  });

  const api = new ApiAutoresbot(config.APIKEY);
  const buffer = await api.getBuffer('/api/convert/webptovideo', { url });
  if (!buffer?.length) throw new Error('hasil konversi kosong');

  fs.writeFileSync(tujuan, buffer);
  return fileBaru;
}

/**
 * Jenis media pada pesan ini (atau pesan yang dibalas).
 * @returns {{ tipePesan: 'image'|'video'|'sticker', gif: boolean }|null}
 */
function deteksiMediaSapaan({ isQuoted, type, message }) {
  const tipePesan = isQuoted ? isQuoted.type : type;
  if (!['image', 'video', 'sticker'].includes(tipePesan)) return null;

  // WhatsApp menandai GIF lewat gifPlayback. Tanpa tanda ini, video biasa
  // akan diputar berulang & kehilangan suaranya.
  const gif = Boolean(
    isQuoted ? isQuoted.content?.gifPlayback : message?.message?.videoMessage?.gifPlayback,
  );

  return { tipePesan, gif };
}

/**
 * Unduh medianya ke folder database/media (bukan tmp, supaya tidak ikut
 * terhapus pembersihan tmp tiap 3 jam).
 *
 * Stiker diubah jadi JPG lebih dulu: WhatsApp menolak WebP yang dikirim
 * sebagai foto biasa.
 *
 * @returns {{ tipe: 'image'|'video', file: string, gif: boolean }|null}
 */
async function simpanMediaSapaan(message, isQuoted, { tipePesan, gif }) {
  const file = isQuoted
    ? await downloadQuotedMedia(message, true)
    : await downloadMedia(message, true);

  if (!file) return null;

  if (tipePesan === 'sticker') {
    const asal = path.join(MEDIA_DIR, file);

    try {
      const isiStiker = fs.readFileSync(asal);

      // Stiker gerak -> video (diputar berulang seperti GIF)
      if (webpAnimasi(isiStiker)) {
        const fileBaru = await stikerGerakKeVideo(file);
        if (fileBaru !== file) deleteMedia(file);
        return { tipe: 'video', file: fileBaru, gif: true };
      }

      // Stiker diam -> gambar biasa (WhatsApp menolak WebP sebagai foto)
      const hasil = await normalizeImageBuffer(isiStiker);
      const fileBaru = `${path.parse(file).name}.jpg`;

      fs.writeFileSync(path.join(MEDIA_DIR, fileBaru), hasil.buffer);
      if (fileBaru !== file) deleteMedia(file);

      return { tipe: 'image', file: fileBaru, gif: false };
    } catch (error) {
      console.error('[SAPAAN] Gagal memproses stiker:', error?.message || error);
      deleteMedia(file);
      return {
        error:
          '⚠️ _Stiker ini gagal diproses._\n\n_Coba kirim sebagai foto/video biasa, atau pakai stiker lain._',
      };
    }
  }

  return { tipe: tipePesan === 'video' ? 'video' : 'image', file, gif };
}

/** Label untuk balasan ke admin. */
function labelMedia({ tipe, gif }) {
  if (tipe === 'video') return gif ? 'GIF sendiri' : 'Video sendiri';
  return 'Foto sendiri';
}

export { deteksiMediaSapaan, simpanMediaSapaan, labelMedia };
