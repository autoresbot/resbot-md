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
  setWelcome,
  setLeft,
  setPromote,
  setDemote,
  setGroupSchedule,
  checkMessage,
};
