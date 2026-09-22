/**
 * maker.js - Helper bersama untuk plugin MAKER yang memanggil /api/maker/*
 * di api.autoresbot.com dan membalas gambar.
 */

import axios from 'axios';
import config from '../config.js';

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

export { ambilGambarMaker, ambilFotoProfil };
