/**
 * uploader.js - Upload media ke tmp-files autoresbot.com.
 *
 * MENGGANTIKAN `api.tmpUpload()` dari paket api-autoresbot, karena paket itu:
 *
 *  1. Mengirim file dengan `fs.createReadStream(path)` tanpa menentukan
 *     content-type. `form-data` lalu menebaknya DARI EKSTENSI FILE. Padahal
 *     `getMediaExtension()` di lib/utils.js selalu memberi `.jpg` untuk setiap
 *     imageMessage WhatsApp, walau isi aslinya WebP/PNG/GIF. Akibatnya server
 *     menerima berkas ber-content-type `image/jpeg` yang isinya bukan JPEG,
 *     lalu menolak:
 *
 *         { status: false, message: 'Isi file tidak sesuai dengan format yang diizinkan.' }
 *
 *  2. Mencetak SELURUH object axios error ke console saat gagal
 *     (`console.log(error)` di node_modules/api-autoresbot/src/index.js),
 *     sehingga log membanjir ratusan baris. File itu ada di node_modules,
 *     jadi tidak bisa diperbaiki permanen — harus dihindari.
 *
 * Modul ini memastikan `filename` + `contentType` SELALU cocok dengan isi file
 * yang sebenarnya (dideteksi dari magic bytes), dan hanya mencetak satu baris
 * ringkas ke console; detail lengkap disimpan ke logs/api.log.
 */

import axios from 'axios';
import FormData from 'form-data';
import { normalizeImageFile, describeImageFile } from './imageNormalizer.js';
import { logApiError } from './errorLogger.js';

const UPLOAD_URL = 'https://autoresbot.com/tmp-files/upload';

const http = axios.create({
  timeout: 30000,
  validateStatus: () => true,
});

/**
 * Log ringkas ke console, detail penuh ke logs/api.log.
 */
function logShort(label, shortMessage, detail) {
  console.log(`[${label}] ${shortMessage}`);
  if (detail) {
    logApiError(detail, { plugin: label, command: 'upload' });
  }
}

/**
 * Upload sebuah file gambar dan kembalikan URL publiknya.
 *
 * @param {string} filePath - path file hasil unduhan (mis. tmp/image_123.jpg)
 * @param {object} [opts]
 * @param {boolean} [opts.convert=true]
 *        true  -> paksa jadi JPEG/PNG. Dipakai fitur yang mengirim FOTO ke API
 *                 pemroses gambar (removebg, wanted, wasted, ai-image, hd).
 *        false -> pertahankan format asli, hanya betulkan metadata. WAJIB untuk
 *                 fitur yang formatnya bermakna (webptovideo, giftoimage).
 * @param {string} [opts.label='UPLOAD'] - prefix log, mis. 'REMOVEBG'
 * @returns {Promise<string>} URL file yang sudah diunggah
 * @throws {Error} error.serverMessage berisi pesan asli dari server bila ada
 */
async function uploadImageFile(filePath, { convert = true, label = 'UPLOAD' } = {}) {
  const prepared = convert ? await normalizeImageFile(filePath) : await describeImageFile(filePath);

  if (prepared.converted) {
    logShort(label, `Gambar dikonversi ${prepared.detected} -> ${prepared.format}`);
  }

  const form = new FormData();
  form.append('file', prepared.buffer, {
    filename: `up_${Date.now()}${prepared.ext}`,
    contentType: prepared.mime,
  });

  const res = await http.post(UPLOAD_URL, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  const url = res.data?.data?.url;

  if (res.status !== 200 || res.data?.code !== 200 || !url) {
    const serverMessage = res.data?.message || res.data?.error || `HTTP ${res.status}`;
    const err = new Error(serverMessage);
    err.serverMessage = serverMessage;
    throw err;
  }

  return url;
}

export { uploadImageFile, logShort };
