/**
 * totalchat.js - Manajemen Total Chat menggunakan SQLite
 * 
 * Refactored dari JSON file ke SQLite.
 * Semua fungsi export tetap sama agar backward compatible.
 */

import { getDb, initDatabase } from './database.js';

initDatabase();

const today = new Date().toLocaleDateString('id-ID', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

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
  const existing = getStmt('getChat', 'SELECT * FROM totalchat WHERE group_id = ? AND user_id = ?')
    .get(groupId, userId);

  if (existing) {
    getStmt('incrementChat', 'UPDATE totalchat SET count = count + 1 WHERE group_id = ? AND user_id = ?')
      .run(groupId, userId);
  } else {
    getStmt('insertChat', 'INSERT INTO totalchat (group_id, user_id, count, created_at) VALUES (?, ?, 1, ?)')
      .run(groupId, userId, today);
  }
}

/**
 * Dapatkan jumlah chat pengguna dalam grup
 */
function getUserChatCount(groupId, userId) {
  const row = getStmt('getChat', 'SELECT * FROM totalchat WHERE group_id = ? AND user_id = ?')
    .get(groupId, userId);
  return row ? row.count : 0;
}

/**
 * Dapatkan total chat semua pengguna dalam grup
 */
function getTotalChatPerGroup(groupId) {
  const rows = getStmt('getChatByGroup', 'SELECT * FROM totalchat WHERE group_id = ?').all(groupId);
  const result = {};
  for (const row of rows) {
    result[row.user_id] = row.count;
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
