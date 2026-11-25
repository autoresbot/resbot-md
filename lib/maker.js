/**
 * maker.js - Helper bersama untuk plugin MAKER yang memanggil /api/maker/*
 * di api.autoresbot.com dan membalas gambar.
 */

import axios from 'axios';
import path from 'path';
import config from '../config.js';
import { downloadQuotedMedia, downloadMedia } from './utils.js';
import { uploadImageFile } from './uploader.js';

const BASE_URL = 'https://api.autoresbot.com';

/**
 * Ambil gambar dari endpoint maker.
 *
 * Sengaja tidak memakai `api-autoresbot.getBuffer`: saat API menolak (HTTP 400
 * dst) badan JSON-nya datang sebagai buffer, sehingga pesan aslinya hilang dan
 * yang tersisa hanya "Bad Request: Unknown error". Di sini badannya dibaca
 * sendiri supaya alasan dari API (mis. parameter kurang) sampai ke pengguna.
 *
 * Gangguan sementara (HTTP 5xx termasuk Cloudflare 520/525, 408, 429, timeout,
 * koneksi putus) diulang sampai MAKS_PERCOBAAN kali. Galat 4xx tidak diulang.
 *
 * @param {string} endpoint mis. '/api/maker/tweet'
 * @param {object} params   query string (nilai kosong/undefined dibuang)
 * @returns {Promise<Buffer>} gambar hasil
 */
async function ambilGambarMaker(endpoint, params = {}) {
  const query = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );

  let galatTerakhir;
  for (let percobaan = 1; percobaan <= MAKS_PERCOBAAN; percobaan++) {
    try {
      return await satuPermintaan(endpoint, query);
    } catch (err) {
      galatTerakhir = err;
      if (!err.bisaDiulang || percobaan === MAKS_PERCOBAAN) break;

      console.warn(
        `[MAKER] ${endpoint} gagal (${err.message}), percobaan ${percobaan}/${MAKS_PERCOBAAN}, ulang...`,
      );
      await new Promise((r) => setTimeout(r, JEDA_ULANG_MS * percobaan));
    }
  }

  if (galatTerakhir.bisaDiulang) {
    throw new Error(`${galatTerakhir.message} (sudah dicoba ${MAKS_PERCOBAAN}x, coba lagi nanti)`);
  }
  throw galatTerakhir;
}

const MAKS_PERCOBAAN = 3;
const JEDA_ULANG_MS = 1500; // dikali nomor percobaan: 1,5 dtk lalu 3 dtk

/** Status yang layak diulang: server sibuk / gangguan sementara. */
const STATUS_SEMENTARA = new Set([408, 429]);

/** Keterangan singkat untuk status yang sering muncul. */
const KETERANGAN_STATUS = {
  401: 'API key tidak valid / kedaluwarsa',
  403: 'Akses ditolak API (cek API key / paket)',
  404: 'Endpoint API tidak ditemukan',
  408: 'Permintaan ke API kehabisan waktu',
  429: 'Terlalu banyak permintaan ke API',
  500: 'Server API sedang error',
  502: 'Server API tidak merespons (bad gateway)',
  503: 'Server API sedang sibuk / maintenance',
  504: 'Server API terlalu lama merespons',
  520: 'Server API membalas tidak wajar (Cloudflare 520)',
  521: 'Server API sedang mati (Cloudflare 521)',
  522: 'Koneksi ke server API timeout (Cloudflare 522)',
  523: 'Server API tidak terjangkau (Cloudflare 523)',
  524: 'Server API terlalu lama memproses (Cloudflare 524)',
  525: 'Gagal handshake SSL ke server API (Cloudflare 525)',
  526: 'Sertifikat SSL server API tidak valid (Cloudflare 526)',
};

function galat(pesan, bisaDiulang) {
  const err = new Error(pesan);
  err.bisaDiulang = bisaDiulang;
  return err;
}

async function satuPermintaan(endpoint, query) {
  let response;
  try {
    response = await axios.get(`${BASE_URL}${endpoint}`, {
      params: { ...query, apikey: config.APIKEY },
      responseType: 'arraybuffer',
      timeout: 60000,
      validateStatus: () => true,
    });
  } catch (err) {
    // Tidak ada balasan sama sekali: timeout, DNS, koneksi diputus, dll.
    const pesan =
      err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT'
        ? 'API tidak merespons (timeout)'
        : `Gagal terhubung ke API (${err.code || err.message})`;
    throw galat(pesan, true);
  }

  const { status } = response;
  const buffer = Buffer.from(response.data || []);
  const pesanApi = bacaGalatApi(buffer);

  if (status === 200 && !pesanApi) return buffer;

  const bisaDiulang = status >= 500 || STATUS_SEMENTARA.has(status) || (status === 200 && buffer.length === 0);
  const keterangan = KETERANGAN_STATUS[status] || `API membalas HTTP ${status}`;

  // Halaman error HTML Cloudflare/server tidak dibaca sebagai pesan API.
  const pesan = status === 200 ? pesanApi : pesanApi ? `${keterangan}: ${pesanApi}` : keterangan;
  throw galat(pesan, bisaDiulang);
}

/**
 * API membalas galat berupa JSON (kadang dengan status 200), bukan gambar.
 * @returns {string|null} pesan galat, atau null bila isinya gambar
 */
function bacaGalatApi(buffer) {
  if (buffer.length === 0) return 'Balasan API kosong';
  if (buffer[0] !== 0x7b) return null; // bukan diawali '{' -> anggap gambar

  try {
    const data = JSON.parse(buffer.toString('utf8'));
    return data?.message || data?.error || 'API menolak permintaan';
  } catch {
    return null;
  }
}

/**
 * URL foto profil WhatsApp, atau undefined kalau tidak ada / disembunyikan
 * (API lalu memakai avatar bawaan).
 */
async function ambilFotoProfil(sock, jid) {
  if (!jid) return undefined;
  try {
    return (await sock.profilePictureUrl(jid, 'image')) || undefined;
  } catch {
    return undefined;
  }
}

/** Apakah pesan (atau pesan yang dibalas) berisi gambar / stiker. */
function adaGambarKiriman({ type, isQuoted }) {
  return ['image', 'sticker'].includes(isQuoted ? isQuoted.type : type);
}

/**
 * Gambar yang dikirim bersama caption command, atau gambar yang di-reply,
 * diupload lalu dikembalikan URL-nya untuk parameter `pp` API maker.
 *
 * @param {object} messageInfo
 * @param {string} label prefix log, mis. 'FAKEGC'
 * @returns {Promise<string|undefined>} URL gambar, atau undefined kalau tidak
 *   ada gambar (pemanggil lalu memakai foto profil / foto bawaan)
 * @throws {Error} kalau gambar ada tapi gagal diunduh / diupload
 */
async function ambilGambarKiriman(messageInfo, label) {
  if (!adaGambarKiriman(messageInfo)) return undefined;

  const { message, isQuoted } = messageInfo;
  const media = isQuoted ? await downloadQuotedMedia(message) : await downloadMedia(message);
  if (!media) throw new Error('Gagal mengunduh gambar dari WhatsApp, coba kirim ulang.');

  try {
    // convert: true -> stiker (WebP) ikut diubah jadi JPEG, dan gambar besar diperkecil.
    return await uploadImageFile(path.join('tmp', media), { convert: true, label });
  } catch (err) {
    throw new Error(`Gagal mengupload gambar: ${err.serverMessage || err.message}`);
  }
}

export { ambilGambarMaker, ambilFotoProfil, adaGambarKiriman, ambilGambarKiriman };
