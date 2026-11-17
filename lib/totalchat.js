/**
 * totalchat.js - Manajemen Total Chat menggunakan SQLite
 * 
 * Refactored dari JSON file ke SQLite.
 * Semua fungsi export tetap sama agar backward compatible.
 */

import { getDb, initDatabase } from './database.js';

initDatabase();

/**
 * Ambil nomor telanjang (tanpa domain @... dan tanpa :device) dari sebuah JID.
 *
 * Kunci totalchat dulu memakai JID mentah (`sender`), yang BENTUKNYA tidak
 * konsisten: kadang `628xx@s.whatsapp.net`, kadang `34772…@lid` saat alamat
 * telepon tidak ikut terkirim. Akibatnya chat orang yang sama tercatat di
 * beberapa baris berbeda dan di `.totalchat` jumlahnya tampak tidak bertambah.
 * Dengan menormalkan ke nomor telanjang, semua bentuk identitas menyatu.
 */
function bareNumber(nilai) {
  if (typeof nilai !== 'string' || !nilai) return null;
  const depan = nilai.split('@')[0].split(':')[0];
  return depan || null;
}

/**
 * Dapatkan tanggal hari ini (dihitung setiap kali dipanggil agar tidak stale)
 */
function getToday() {
  return new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

let stmtCache = {};

function getStmt(key, sql) {
  if (!stmtCache[key]) {
    stmtCache[key] = getDb().prepare(sql);
  }
  return stmtCache[key];
}

/**
 * Tambah jumlah chat pengguna dalam grup
 */
function incrementUserChatCount(groupId, userId) {
  // Simpan dengan kunci nomor telanjang agar konsisten (lihat bareNumber).
  const key = bareNumber(userId) || userId;

  const existing = getStmt('getChat', 'SELECT * FROM totalchat WHERE group_id = ? AND user_id = ?')
    .get(groupId, key);

  if (existing) {
    getStmt('incrementChat', 'UPDATE totalchat SET count = count + 1 WHERE group_id = ? AND user_id = ?')
      .run(groupId, key);
  } else {
    getStmt('insertChat', 'INSERT INTO totalchat (group_id, user_id, count, created_at) VALUES (?, ?, 1, ?)')
      .run(groupId, key, getToday());
  }
}

/**
 * Dapatkan jumlah chat pengguna dalam grup
 */
function getUserChatCount(groupId, userId) {
  const key = bareNumber(userId) || userId;
  const row = getStmt('getChat', 'SELECT * FROM totalchat WHERE group_id = ? AND user_id = ?')
    .get(groupId, key);
  return row ? row.count : 0;
}

/**
 * Dapatkan total chat semua pengguna dalam grup
 */
function getTotalChatPerGroup(groupId) {
  const rows = getStmt('getChatByGroup', 'SELECT * FROM totalchat WHERE group_id = ?').all(groupId);
  const result = {};
  for (const row of rows) {
    // Normalkan + jumlahkan: baris lama bisa berkunci JID penuh (phone/LID)
    // sementara baris baru berkunci nomor telanjang. Keduanya disatukan di sini
    // supaya total per orang akurat dan tidak terpecah.
    const key = bareNumber(row.user_id) || row.user_id;
    result[key] = (result[key] || 0) + row.count;
  }
  return result;
}

/**
 * Reset total chat dalam grup tertentu
 */
async function resetTotalChatPerGroup(groupId) {
  const result = getStmt('deleteChatByGroup', 'DELETE FROM totalchat WHERE group_id = ?').run(groupId);
  return result.changes > 0;
}

/**
 * Reset total chat seluruh grup
 */
async function resetAllTotalChat() {
  getStmt('deleteAllChat', 'DELETE FROM totalchat').run();
}

export {
  incrementUserChatCount,
  getUserChatCount,
  getTotalChatPerGroup,
  resetTotalChatPerGroup,
  resetAllTotalChat,
};
