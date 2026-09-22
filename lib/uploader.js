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
    const meta = { plugin: label, command: 'upload' };
    // Body respons mentah dari API ikut disimpan agar penyebabnya bisa dilacak.
    if (detail.responseData !== undefined) {
      const body =
        typeof detail.responseData === 'string'
          ? detail.responseData
          : JSON.stringify(detail.responseData);
      meta.response = body?.slice(0, 2000);
    }
    logApiError(detail, meta);
  }
}

/**
 * Ringkas respons API jadi satu kalimat yang bisa ditampilkan ke pengguna,
 * mis. "HTTP 400 - Parameter apikey dibutuhkan. (MISSING_API_KEY)".
 *
 * Server autoresbot membalas JSON `{ status, message, error_code }`, tapi
 * proxy di depannya (mis. 413 dari nginx / halaman Cloudflare) bisa membalas
 * HTML. Body berupa teks dibersihkan dari tag dan dipotong supaya pesan WA
 * tidak berisi halaman HTML utuh.
 */
function formatApiResponse(res) {
  const data = res?.data;
  let detail = '';

  if (data && typeof data === 'object' && !Buffer.isBuffer(data)) {
    detail = data.message || data.error || data.msg || '';
    if (typeof detail !== 'string') detail = JSON.stringify(detail);
    if (!detail) detail = JSON.stringify(data);
    if (data.error_code && !detail.includes(data.error_code)) detail += ` (${data.error_code})`;
  } else if (data != null) {
    detail = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
    detail = detail
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (detail.length > 200) detail = detail.slice(0, 200) + '...';
  const status = res?.status ? `HTTP ${res.status}` : 'Tanpa respons';
  return detail ? `${status} - ${detail}` : status;
}

/**
 * Pesan untuk error jaringan (tidak ada respons HTTP sama sekali). Tanpa ini
 * pengguna hanya melihat teks axios seperti "timeout of 30000ms exceeded".
 */
function formatNetworkError(error, target = 'server') {
  const code = error?.code;
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || /timeout/i.test(error?.message || '')) {
    return `Tidak ada respons dari ${target} (timeout)`;
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return `Tidak bisa menghubungi ${target} (DNS gagal / tidak ada internet)`;
  }
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET') {
    return `Koneksi ke ${target} ditolak/terputus (${code})`;
  }
  return `Gagal menghubungi ${target}: ${error?.message || error}`;
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
 * @throws {Error} error.serverMessage berisi ringkasan respons server
 *         (status HTTP + pesan), siap ditampilkan ke pengguna
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

  let res;
  try {
    res = await http.post(UPLOAD_URL, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
  } catch (error) {
    // validateStatus selalu true, jadi yang sampai sini hanya error jaringan.
    const err = new Error(formatNetworkError(error, 'server upload'));
    err.serverMessage = err.message;
    err.cause = error;
    throw err;
  }

  const url = res.data?.data?.url;

  if (res.status !== 200 || res.data?.code !== 200 || !url) {
    const serverMessage = formatApiResponse(res);
    const err = new Error(serverMessage);
    err.serverMessage = serverMessage;
    err.status = res.status;
    err.responseData = res.data; // ikut tersimpan di logs/api.log
    throw err;
  }

  return url;
}

export { uploadImageFile, logShort, formatApiResponse, formatNetworkError };
