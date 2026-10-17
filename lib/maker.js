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
 * @param {string} endpoint mis. '/api/maker/tweet'
 * @param {object} params   query string (nilai kosong/undefined dibuang)
 * @returns {Promise<Buffer>} gambar hasil
 */
async function ambilGambarMaker(endpoint, params = {}) {
  const query = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );

  const response = await axios.get(`${BASE_URL}${endpoint}`, {
    params: { ...query, apikey: config.APIKEY },
    responseType: 'arraybuffer',
    timeout: 60000,
    validateStatus: () => true,
  });

  const buffer = Buffer.from(response.data || []);
  const galat = bacaGalatApi(buffer);

  if (response.status !== 200 || galat) {
    throw new Error(galat || `API membalas HTTP ${response.status}`);
  }
  return buffer;
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
