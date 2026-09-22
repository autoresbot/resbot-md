/**
 * participants.js - Manajemen Participant Settings menggunakan SQLite
 * 
 * Refactored dari JSON file ke SQLite.
 * Semua fungsi export tetap sama agar backward compatible.
 */

import { getDb, safeJsonParse, toJson, initDatabase } from './database.js';
import { updateSocket } from './scheduled.js';
import { cleanText } from './utils.js';

initDatabase();

let stmtCache = {};

function getStmt(key, sql) {
  if (!stmtCache[key]) {
    stmtCache[key] = getDb().prepare(sql);
  }
  return stmtCache[key];
}

/**
 * Helper: baca data participant dari SQLite
 */
function readData(remoteJid) {
  const row = getStmt('getById', 'SELECT * FROM participants WHERE id = ?').get(remoteJid);
  if (!row) return null;
  return safeJsonParse(row.data, {});
}

/**
 * Helper: simpan data participant ke SQLite
 */
function writeData(remoteJid, data) {
  const existing = getStmt('getById', 'SELECT id FROM participants WHERE id = ?').get(remoteJid);
  if (existing) {
    getStmt('updateData', 'UPDATE participants SET data = ? WHERE id = ?')
      .run(toJson(data), remoteJid);
  } else {
    getStmt('insertData', 'INSERT INTO participants (id, data) VALUES (?, ?)')
      .run(remoteJid, toJson(data));
  }
}

/**
 * Helper: baca semua data
 */
function readAllData() {
  const rows = getStmt('readAll', 'SELECT * FROM participants').all();
  const result = {};
  for (const row of rows) {
    result[row.id] = safeJsonParse(row.data, {});
  }
  return result;
}

// ==== Public Functions ====

async function setWelcome(remoteJid, text) {
  let data = readData(remoteJid) || {};
  const cleanTxt = text ? cleanText(text) : 'Selamat datang di grup!';
  data.add = cleanTxt;
  writeData(remoteJid, data);
}

async function setLeft(remoteJid, text) {
  let data = readData(remoteJid) || {};
  const cleanTxt = text ? cleanText(text) : 'Selamat jalan, semoga sukses!';
  data.remove = cleanTxt;
  writeData(remoteJid, data);
}

async function setPromote(remoteJid, text) {
  let data = readData(remoteJid) || {};
  const cleanTxt = text ? cleanText(text) : 'Selamat! Anda telah dipromosikan menjadi admin.';
  data.promote = cleanTxt;
  writeData(remoteJid, data);
}

async function setDemote(remoteJid, text) {
  let data = readData(remoteJid) || {};
  const cleanTxt = text ? cleanText(text) : 'Maaf, Anda telah diturunkan dari admin.';
  data.demote = cleanTxt;
  writeData(remoteJid, data);
}

async function setTemplateList(remoteJid, text) {
  let data = readData(remoteJid) || {};
  data.templatelist = text || '1';
  writeData(remoteJid, data);
}

async function setList(remoteJid, text) {
  let data = readData(remoteJid) || {};
  const cleanTxt = text ? cleanText(text) : 'Template list default dari set list';
  data.setlist = cleanTxt;
  writeData(remoteJid, data);
}

async function setDone(remoteJid, text) {
  let data = readData(remoteJid) || {};
  const cleanTxt = text ? cleanText(text) : 'Template Done default';
  data.setdone = cleanTxt;
  writeData(remoteJid, data);
}

async function setProses(remoteJid, text) {
  let data = readData(remoteJid) || {};
  const cleanTxt = text ? cleanText(text) : 'Template Done default';
  data.setproses = cleanTxt;
  writeData(remoteJid, data);
}

async function setTemplateWelcome(remoteJid, text) {
  let data = readData(remoteJid) || {};
  data.templatewelcome = text || '1';
  writeData(remoteJid, data);
}

/**
 * Simpan foto/video welcome milik grup sendiri.
 *
 * Mode-nya ditandai dengan templatewelcome = 'media', supaya jalur pengiriman
 * (lib/participant_update.js) tahu harus memakai file ini, bukan template
 * gambar bawaan bot.
 *
 * @param {'image'|'video'} tipe
 * @param {string} file nama file di folder database/media
 * @param {boolean} gif true hanya bila sumbernya GIF — video biasa yang
 *   dikirim dengan penanda GIF akan diputar berulang & kehilangan suaranya
 * @returns {string|null} nama file LAMA yang digantikan (untuk dihapus)
 */
async function setWelcomeMedia(remoteJid, tipe, file, gif = false) {
  let data = readData(remoteJid) || {};
  const lama = data.welcomeMedia?.file || null;

  data.welcomeMedia = { tipe, file, gif: Boolean(gif) };
  data.templatewelcome = 'media';
  writeData(remoteJid, data);

  return lama && lama !== file ? lama : null;
}

/** @returns {{ tipe: 'image'|'video', file: string, gif?: boolean }|null} */
function getWelcomeMedia(remoteJid) {
  const data = readData(remoteJid) || {};
  const media = data.welcomeMedia;
  if (!media?.file || !media?.tipe) return null;
  return media;
}

/**
 * Tampilan pesan perpisahan (.setleft):
 * 'text' | 'default' (gambar goodbye dari API) | 'media' (foto/video sendiri)
 */
async function setTemplateLeft(remoteJid, text) {
  let data = readData(remoteJid) || {};
  data.templateleft = text || 'text';
  writeData(remoteJid, data);
}

/** Sama seperti setWelcomeMedia, tapi untuk pesan perpisahan. */
async function setLeftMedia(remoteJid, tipe, file, gif = false) {
  let data = readData(remoteJid) || {};
  const lama = data.leftMedia?.file || null;

  data.leftMedia = { tipe, file, gif: Boolean(gif) };
  data.templateleft = 'media';
  writeData(remoteJid, data);

  return lama && lama !== file ? lama : null;
}

/** @returns {{ tipe: 'image'|'video', file: string, gif?: boolean }|null} */
function getLeftMedia(remoteJid) {
  const data = readData(remoteJid) || {};
  const media = data.leftMedia;
  if (!media?.file || !media?.tipe) return null;
  return media;
}

/**
 * Auto delete: hapus pesan welcome/left setelah sekian detik.
 *
 * @param {'welcome'|'left'} jenis
 * @param {number|null} detik null / 0 -> fitur dimatikan
 */
async function setAutoDelete(remoteJid, jenis, detik) {
  let data = readData(remoteJid) || {};
  const kunci = jenis === 'left' ? 'autodelleft' : 'autodelwelcome';

  if (!detik) {
    delete data[kunci];
  } else {
    data[kunci] = Number(detik);
  }

  writeData(remoteJid, data);
}

/** @returns {number} detik, atau 0 kalau tidak aktif */
function getAutoDelete(remoteJid, jenis) {
  const data = readData(remoteJid) || {};
  const detik = Number(data[jenis === 'left' ? 'autodelleft' : 'autodelwelcome']);
  return Number.isFinite(detik) && detik > 0 ? detik : 0;
}

/**
 * Teks khusus saat grup dibuka/ditutup otomatis (.setopengc / .setclosegc).
 * Kosong -> bot memakai teks bawaan.
 *
 * @param {'openText'|'closeText'} property
 */
async function setJadwalTeks(remoteJid, property, teks) {
  let data = readData(remoteJid) || {};

  if (!teks) {
    delete data[property];
  } else {
    data[property] = cleanText(teks);
  }

  writeData(remoteJid, data);
}

/** @returns {string} teks khusus, atau '' kalau memakai teks bawaan */
function getJadwalTeks(remoteJid, property) {
  const data = readData(remoteJid) || {};
  const teks = data[property];
  return typeof teks === 'string' ? teks : '';
}

async function setGroupSchedule(sock, remoteJid, text, property) {
  let data = readData(remoteJid) || {};

  if (text.toLowerCase() === 'off') {
    if (data[property]) {
      delete data[property];
    } else {
      console.log(`${property} tidak ditemukan untuk grup ${remoteJid}.`);
    }
  } else {
    data[property] = text;
  }

  writeData(remoteJid, data);
  updateSocket(sock);
}

async function checkMessage(remoteJid, type) {
  const data = readAllData();
  if (!data || typeof data !== 'object') {
    throw new Error('Data tidak valid atau gagal dibaca.');
  }

  if (!data[remoteJid]) return false;

  const messageTypes = {
    add: 'add',
    remove: 'remove',
    promote: 'promote',
    demote: 'demote',
    templatelist: 'templatelist',
    templatewelcome: 'templatewelcome',
    templateleft: 'templateleft',
    jadwalsholat: 'jadwalsholat',
    setlist: 'setlist',
    setdone: 'setdone',
    setproses: 'setproses',
  };

  const messageKey = messageTypes[type];
  if (!messageKey) {
    throw new Error(
      `Tipe yang diberikan tidak valid. Tipe yang didukung: ${Object.keys(messageTypes).join(', ')}`
    );
  }
  const messageData = data[remoteJid][messageKey];
  return messageData || false;
}

async function deleteMessage(remoteJid, type) {
  let data = readData(remoteJid);
  if (!data) return false;

  const messageTypes = {
    add: 'add',
    remove: 'remove',
    promote: 'promote',
    demote: 'demote',
    templatelist: 'templatelist',
    templatewelcome: 'templatewelcome',
    templateleft: 'templateleft',
    jadwalsholat: 'jadwalsholat',
    setlist: 'setlist',
    setdone: 'setdone',
    setproses: 'setproses',
  };

  const messageKey = messageTypes[type];
  if (!messageKey || !data[messageKey]) return false;

  delete data[messageKey];

  // Jika tidak ada lagi kunci, hapus dari database
  if (Object.keys(data).length === 0) {
    getStmt('deleteById', 'DELETE FROM participants WHERE id = ?').run(remoteJid);
  } else {
    writeData(remoteJid, data);
  }

  return true;
}

export {
  setTemplateList,
  setList,
  setDone,
  setProses,
  deleteMessage,
  setTemplateWelcome,
  setWelcomeMedia,
  getWelcomeMedia,
  setTemplateLeft,
  setLeftMedia,
  getLeftMedia,
  setAutoDelete,
  getAutoDelete,
  setJadwalTeks,
  getJadwalTeks,
  setWelcome,
  setLeft,
  setPromote,
  setDemote,
  setGroupSchedule,
  checkMessage,
};
