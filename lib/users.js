/**
 * users.js - Manajemen User menggunakan SQLite
 *
 * Refactored dari JSON file ke SQLite.
 * Semua fungsi export tetap sama agar backward compatible.
 */

import config from '../config.js';
import { getDb, safeJsonParse, toJson, initDatabase } from './database.js';

// Pastikan database diinisialisasi
initDatabase();

const MS_IN_A_DAY = 24 * 60 * 60 * 1000;

// ==== Prepared Statements (di-cache untuk performa) ====
let stmtCache = {};

function getStmt(key, sql) {
  if (!stmtCache[key]) {
    stmtCache[key] = getDb().prepare(sql);
  }
  return stmtCache[key];
}

// ==== Helper: convert row ke format lama ====
function rowToUser(row) {
  if (!row) return null;
  return {
    username: row.username,
    aliases: safeJsonParse(row.aliases, []),
    money: row.money,
    limit: row.limit_count,
    level_cache: row.level_cache,
    level: row.level,
    role: row.role,
    achievement: row.achievement,
    status: row.status,
    premium: row.premium || undefined,
    afk: safeJsonParse(row.afk, { lastchat: 0, alasan: null }),
    birthday: row.birthday || undefined,
    birthYear: row.birth_year || undefined,
    lastBirthdayWish: row.last_birthday_wish || undefined,
    lastClaim: row.last_claim || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==== CRUD Functions ====

function generateUUID() {
  return (
    'xxxxxxxxyxxxxyxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    }) + Date.now().toString(16)
  );
}

/**
 * Baca semua users - mengembalikan object format lama { id: userData }
 */
async function readUsers() {
  const rows = getStmt('readAll', 'SELECT * FROM users').all();
  const result = {};
  for (const row of rows) {
    result[row.id] = rowToUser(row);
  }
  return result;
}

/**
 * Tambah user baru
 */
function addUser(id, userData) {
  try {
    const existing = getStmt('getById', 'SELECT id FROM users WHERE id = ?').get(id);
    if (existing) return false;

    getStmt(
      'insertUser',
      `
      INSERT INTO users (id, username, aliases, money, limit_count, level_cache, level, role, achievement, status, premium, afk, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      id,
      userData.username || `user_${id}`,
      toJson(userData.aliases || [id]),
      userData.money || 0,
      userData.limit || 0,
      userData.level_cache || 0,
      userData.level || 1,
      userData.role || 'user',
      userData.achievement || 'gamers',
      userData.status || 'active',
      userData.premium || null,
      toJson(userData.afk || { lastchat: 0, alasan: null }),
      new Date().toISOString(),
      new Date().toISOString(),
    );
    return true;
  } catch (error) {
    console.error('❌ Error addUser:', error.message);
    return false;
  }
}

// ==== Pencarian user lewat nomor/JID di aliases ====
//
// Dulu setiap pencarian menjalankan `SELECT * FROM users` lalu JSON.parse
// aliases SETIAP baris di JavaScript. Pencarian ini terjadi ±4x per pesan
// (cek premium, handler, register, update level), jadi dengan ribuan user
// satu pesan grup memakan ratusan ms CPU sinkron. Di panel < 1 core dengan
// puluhan grup aktif, event loop tersumbat terus: CPU 90%+, ping keepalive
// WhatsApp gagal ("socket resume requested by keepalive ping failure") dan
// semua pengiriman ikut gagal.
//
// Sekarang:
// 1. indeks memori nomor -> docId, lalu baris diambil lewat primary key.
//    Hasil indeks SELALU diverifikasi ke baris aslinya, jadi indeks basi
//    (user dihapus/diedit dari dashboard) tidak pernah memberi user salah.
// 2. bila tidak ada di indeks, SQLite yang memfilter (`LIKE`, berjalan di C)
//    dan hanya kandidatnya yang di-parse. Hasil "tidak ketemu" tetap pasti,
//    sehingga tidak ada pendaftaran ganda.

/** nomor (digit saja) -> docId */
const numberIndex = new Map();

const digitsOf = (value) => String(value ?? '').replace(/\D/g, '');

function parseAliases(row) {
  const aliases = safeJsonParse(row?.aliases, []);
  return Array.isArray(aliases) ? aliases : [];
}

function rowHasNumber(row, number) {
  return parseAliases(row).some((alias) => digitsOf(alias) === number);
}

function indexRow(row) {
  for (const alias of parseAliases(row)) {
    const number = digitsOf(alias);
    // Pertahankan pemetaan yang sudah ada: kalau ada data ganda, yang dipakai
    // tetap yang pertama ditemukan (sama seperti urutan pemindaian lama).
    if (number && !numberIndex.has(number)) numberIndex.set(number, row.id);
  }
}

/** Baris user pertama yang salah satu alias-nya bernomor `number`. */
function findRowByNumber(number) {
  if (!number) return undefined;

  const cachedId = numberIndex.get(number);
  if (cachedId) {
    const row = getStmt('rowById', 'SELECT * FROM users WHERE id = ?').get(cachedId);
    if (row && rowHasNumber(row, number)) return row;
    numberIndex.delete(number);
  }

  const candidates = getStmt(
    'rowsByAliasLike',
    'SELECT * FROM users WHERE aliases LIKE ? ORDER BY rowid',
  ).all(`%${number}%`);

  for (const row of candidates) {
    if (rowHasNumber(row, number)) {
      indexRow(row);
      return row;
    }
  }
  return undefined;
}

/** Baris user pertama yang alias-nya persis `jid`. */
function findRowByExactAlias(jid) {
  if (!jid) return undefined;
  const byNumber = findRowByNumber(digitsOf(jid));
  if (byNumber && parseAliases(byNumber).includes(jid)) return byNumber;

  const candidates = getStmt(
    'rowsByAliasLike',
    'SELECT * FROM users WHERE aliases LIKE ? ORDER BY rowid',
  ).all(`%${jid}%`);
  return candidates.find((row) => parseAliases(row).includes(jid));
}

/**
 * Cek apakah user sudah terdaftar (berdasarkan JID di aliases)
 */
function isUserRegistered(jid) {
  return Boolean(findRowByExactAlias(jid));
}

/**
 * Cari user berdasarkan JID di aliases
 */
function findUserByAnyId(jid) {
  const row = findRowByExactAlias(jid);
  return row ? [row.id, rowToUser(row)] : undefined;
}

/**
 * Cari user berdasarkan docId (primary key tabel users)
 * @returns {[string, object]|undefined}
 */
function findUserByDocId(docId) {
  if (!docId) return undefined;
  const row = getStmt('byDocId', 'SELECT * FROM users WHERE id = ?').get(docId);
  if (!row) return undefined;
  return [row.id, rowToUser(row)];
}

/**
 * Cari user berdasarkan username
 */
function findUserByUsername(username) {
  const uname = username.toLowerCase();
  const row = getStmt('byUsername', 'SELECT * FROM users WHERE username = ?').get(uname);
  if (!row) return undefined;
  return [row.id, rowToUser(row)];
}

/**
 * Register user baru (logic sama persis dengan versi JSON)
 */
function registerUser(jid, username) {
  const uname = username.toLowerCase();

  const userByUsername = findUserByUsername(uname);
  const userByJid = findUserByAnyId(jid);

  // CASE 1: Username belum ada di DB
  if (!userByUsername) {
    if (!userByJid) {
      // Register baru
      const userId = generateUUID();
      getStmt(
        'insertUser',
        `
        INSERT INTO users (id, username, aliases, money, limit_count, level_cache, level, role, achievement, status, premium, afk, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        userId,
        uname,
        toJson([jid]),
        0,
        0,
        0,
        1,
        'user',
        'gamers',
        'active',
        null,
        toJson({ lastchat: 0, alasan: null }),
        new Date().toISOString(),
        new Date().toISOString(),
      );
      return userId;
    } else {
      return 'registered';
    }
  }

  // CASE 2: Username sudah ada
  const [usernameUserId, usernameUser] = userByUsername;

  if (userByJid) {
    const [jidUserId] = userByJid;
    if (jidUserId === usernameUserId) {
      return 'registered';
    } else {
      return 'taken';
    }
  } else {
    const isLid = jid.endsWith('@lid');
    const isWa = jid.endsWith('@s.whatsapp.net');

    const hasSameType = usernameUser.aliases.some(
      (existing) =>
        (isLid && existing.endsWith('@lid')) || (isWa && existing.endsWith('@s.whatsapp.net')),
    );

    if (!hasSameType) {
      // Tambahkan alias baru
      const newAliases = [...usernameUser.aliases, jid];
      getStmt('updateAliases', 'UPDATE users SET aliases = ?, updated_at = ? WHERE id = ?').run(
        toJson(newAliases),
        new Date().toISOString(),
        usernameUserId,
      );
      return 'registered';
    } else {
      return 'taken';
    }
  }
}

/**
 * Update user
 */
function updateUser(id, updateData) {
  const cariData = findUser(id, 'Debug 2');
  if (!cariData) return false;

  const [docId, oldData] = cariData;

  if (updateData.money !== undefined) {
    updateData.money = Math.max(0, updateData.money);
  }
  if (updateData.limit !== undefined) {
    updateData.limit = Math.max(0, updateData.limit);
  }

  const merged = { ...oldData, ...updateData };

  getStmt(
    'updateUser',
    `
    UPDATE users SET 
      username = ?, aliases = ?, money = ?, limit_count = ?,
      level_cache = ?, level = ?, role = ?, achievement = ?,
      status = ?, premium = ?, afk = ?,
      birthday = ?, birth_year = ?, last_birthday_wish = ?,
      last_claim = ?, updated_at = ?
    WHERE id = ?
  `,
  ).run(
    merged.username,
    toJson(merged.aliases ?? []),
    merged.money ?? 0,
    merged.limit ?? 0,
    merged.level_cache ?? 0,
    merged.level ?? 1,
    merged.role ?? 'user',
    merged.achievement ?? 'gamers',
    merged.status ?? 'active',
    merged.premium ?? null,
    toJson(merged.afk ?? { lastchat: 0, alasan: null }),
    merged.birthday ?? null,
    merged.birthYear ?? null,
    merged.lastBirthdayWish ?? null,
    merged.lastClaim ?? null,
    new Date().toISOString(),
    docId,
  );

  return true;
}

/**
 * Hapus user
 */
function deleteUser(id) {
  const result = getStmt('deleteUser', 'DELETE FROM users WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Satukan data user nomor HP (@s.whatsapp.net) dengan data LID (@lid) miliknya.
 *
 * Dulu chat pribadi membaca pengirim sebagai nomor HP sedangkan grup membaca
 * LID, sehingga satu orang bisa punya dua data user terpisah. Dipanggil saat
 * LID dari sebuah nomor diketahui:
 * - hanya ada data nomor HP -> LID ditambahkan ke aliases-nya
 * - hanya ada data LID      -> nomor HP ditambahkan ke aliases-nya
 * - ada keduanya            -> data nomor HP dilebur ke data LID lalu dihapus
 *
 * @returns {'none'|'linked'|'merged'}
 */
function linkUserLid(pnJid, lidJid) {
  if (!pnJid?.endsWith('@s.whatsapp.net') || !lidJid?.endsWith('@lid')) return 'none';

  const pnUser = findUserByAnyId(pnJid);
  const lidUser = findUserByAnyId(lidJid);
  if (!pnUser && !lidUser) return 'none';

  const addAlias = ([docId, data], jid) => {
    if (data.aliases.includes(jid)) return;
    getStmt('updateAliases', 'UPDATE users SET aliases = ?, updated_at = ? WHERE id = ?').run(
      toJson([...data.aliases, jid]),
      new Date().toISOString(),
      docId,
    );
  };

  if (!lidUser) {
    addAlias(pnUser, lidJid);
    return 'linked';
  }
  if (!pnUser) {
    addAlias(lidUser, pnJid);
    return 'linked';
  }

  const [pnId, pn] = pnUser;
  const [lidId, lid] = lidUser;
  if (pnId === lidId) return 'none';

  const later = (a, b) => (!a ? b : !b ? a : new Date(a) > new Date(b) ? a : b);
  const isAutoName = (name) => !name || name.startsWith('user_');
  const higher = (pn.level || 0) > (lid.level || 0) ? pn : lid;

  const merged = {
    // Username buatan sendiri dipertahankan; yang otomatis (user_...) dibuang.
    username: isAutoName(lid.username) && !isAutoName(pn.username) ? pn.username : lid.username,
    aliases: [...new Set([...lid.aliases, ...pn.aliases])],
    money: (lid.money || 0) + (pn.money || 0),
    limit: (lid.limit || 0) + (pn.limit || 0),
    level: higher.level || 1,
    level_cache: higher.level_cache || 0,
    role: lid.role !== 'user' ? lid.role : pn.role,
    premium: later(lid.premium, pn.premium) ?? null,
    birthday: lid.birthday ?? pn.birthday ?? null,
    birthYear: lid.birthYear ?? pn.birthYear ?? null,
    lastBirthdayWish: later(lid.lastBirthdayWish, pn.lastBirthdayWish) ?? null,
    lastClaim: later(lid.lastClaim, pn.lastClaim) ?? null,
    createdAt: pn.createdAt < lid.createdAt ? pn.createdAt : lid.createdAt,
  };

  getDb().transaction(() => {
    // Hapus dulu data nomor HP supaya username-nya (UNIQUE) bisa dipakai data LID.
    deleteUser(pnId);
    getStmt(
      'mergeUser',
      `
      UPDATE users SET
        username = ?, aliases = ?, money = ?, limit_count = ?,
        level_cache = ?, level = ?, role = ?, premium = ?,
        birthday = ?, birth_year = ?, last_birthday_wish = ?,
        last_claim = ?, created_at = ?, updated_at = ?
      WHERE id = ?
    `,
    ).run(
      merged.username,
      toJson(merged.aliases),
      merged.money,
      merged.limit,
      merged.level_cache,
      merged.level,
      merged.role,
      merged.premium,
      merged.birthday,
      merged.birthYear,
      merged.lastBirthdayWish,
      merged.lastClaim,
      merged.createdAt,
      new Date().toISOString(),
      lidId,
    );
  })();

  return 'merged';
}

/**
 * Cari user (by username, by JID, atau auto-register).
 *
 * SELALU mengembalikan tuple `[docId, userData]` atau `null`. Kontrak ini
 * dipakai oleh 24+ pemanggil yang langsung melakukan
 * `const [docId, userData] = findUser(...)`, sehingga mengembalikan bentuk lain
 * (mis. docId berupa string polos) akan membuat pemanggil mendestrukturisasi
 * string per-karakter dan menghasilkan data sampah.
 *
 * @returns {[string, object]|null}
 */
function findUser(id, options = 'any') {
  // Buat debug log untuk opsi pencarian
  //console.log('options findUser:', id);

  if (!id) return null;

  // 1. Cari by username
  let user = findUserByUsername(id);
  if (user) return user;

  // 2. Cari by nomor HP di aliases
  const row = findRowByNumber(digitsOf(id));
  if (row) return [row.id, rowToUser(row)];

  // 3. Auto-register
  try {
    const username = `user_${id.toLowerCase()}`;

    // registerUser() mengembalikan STRING: docId user baru, atau penanda
    // 'registered' / 'taken'. Nilai itu tidak boleh diteruskan apa adanya ke
    // pemanggil — resolve ulang supaya bentuknya tetap [docId, userData].
    const registerResult = registerUser(id, username);

    // User benar-benar baru dibuat -> ambil record-nya langsung lewat docId.
    if (registerResult && registerResult !== 'registered' && registerResult !== 'taken') {
      user = findUserByDocId(registerResult);
      if (user) return user;
    }

    // 'registered' = alias ditambahkan ke user yang sudah ada -> cari lewat id.
    // 'taken' = username sudah dipakai orang lain; resolveUser sengaja
    // mengembalikan null daripada menebak dan memberikan record orang lain.
    user = resolveUser(id);
    if (user) return user;
  } catch (error) {
    console.log('GAGAL REGISTER OTOMATIS:', error);
  }

  return null;
}

/**
 * Cari user TANPA auto-register (untuk transaksi yang butuh kepastian user ada).
 * @returns {[string, object]|null} [docId, userData] atau null bila tidak ada
 */
function resolveUser(id) {
  if (!id) return null;

  // 1. by username
  const byUsername = findUserByUsername(id);
  if (byUsername) return byUsername;

  // 2. by nomor di aliases
  const row = findRowByNumber(digitsOf(id));
  if (row) return [row.id, rowToUser(row)];

  return null;
}

/**
 * Cari user dari BEBERAPA kemungkinan identitas (tanpa auto-register).
 *
 * Satu orang bisa punya dua ruang identitas di WhatsApp: LID (mis.
 * `69243815079978@lid`) dan nomor telpon (mis. `6285246154386@s.whatsapp.net`).
 * Keduanya bisa tersimpan sebagai record user yang BERBEDA, sehingga pencarian
 * dengan ruang identitas yang salah akan mengenai record duplikat.
 *
 * Kandidat diperiksa berurutan agar pemanggil bisa menentukan ruang identitas
 * mana yang diprioritaskan.
 *
 * @param {string|Array<string>} identifiers - satu identitas atau daftar kandidat
 * @returns {[string, object]|null} [docId, userData] atau null bila tidak ada
 */
function resolveUserAny(identifiers) {
  const list = Array.isArray(identifiers) ? identifiers : [identifiers];
  for (const identifier of list) {
    if (!identifier) continue;
    const found = resolveUser(identifier);
    if (found) return found;
  }
  return null;
}

/**
 * Transfer saldo (money) atau limit antar user secara ATOMIC.
 *
 * Memakai transaction better-sqlite3: bila salah satu langkah gagal, SELURUH
 * perubahan di-rollback sehingga saldo/limit pengirim tidak pernah berkurang
 * tanpa penerima menerima. Juga melakukan verifikasi nilai sebelum & sesudah.
 *
 * @param {string|Array<string>} fromIdentifier - identitas pengirim (JID/LID/nomor),
 *   boleh berupa daftar kandidat yang diperiksa berurutan
 * @param {string|Array<string>} toIdentifier - identitas penerima (JID/LID/nomor),
 *   boleh berupa daftar kandidat yang diperiksa berurutan
 * @param {number} amount - jumlah (> 0, bilangan bulat)
 * @param {'money'|'limit'} field - jenis saldo
 * @returns {{ok:boolean, reason?:string, detail?:string, fromBefore?:number, fromAfter?:number, toBefore?:number, toAfter?:number, fromDocId?:string, toDocId?:string}}
 */
function transferBalance(fromIdentifier, toIdentifier, amount, field = 'money') {
  const column = field === 'limit' ? 'limit_count' : 'money';

  // 1. Validasi nominal
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
    return { ok: false, reason: 'amount' };
  }

  // 2. Validasi pengirim & penerima (tanpa auto-register)
  const from = resolveUserAny(fromIdentifier);
  if (!from) return { ok: false, reason: 'sender_not_found' };
  const to = resolveUserAny(toIdentifier);
  if (!to) return { ok: false, reason: 'recipient_not_found' };

  const fromDocId = from[0];
  const toDocId = to[0];

  // 3. Tidak boleh kirim ke diri sendiri (bandingkan docId, bukan nomor —
  //    LID & nomor telpon berbeda ruang angka sehingga perbandingan nomor tidak andal)
  if (fromDocId === toDocId) return { ok: false, reason: 'self' };

  // 4. Eksekusi atomic di dalam transaction
  try {
    const db = getDb();
    const run = db.transaction(() => {
      const fromRow = db.prepare(`SELECT ${column} AS val FROM users WHERE id = ?`).get(fromDocId);
      const toRow = db.prepare(`SELECT ${column} AS val FROM users WHERE id = ?`).get(toDocId);
      if (!fromRow) throw new Error('sender_not_found');
      if (!toRow) throw new Error('recipient_not_found');

      const fromBefore = Number(fromRow.val) || 0;
      const toBefore = Number(toRow.val) || 0;

      if (fromBefore < amount) throw new Error('insufficient');

      const fromAfter = fromBefore - amount;
      const toAfter = toBefore + amount;
      const now = new Date().toISOString();

      db.prepare(`UPDATE users SET ${column} = ?, updated_at = ? WHERE id = ?`).run(
        fromAfter,
        now,
        fromDocId,
      );
      db.prepare(`UPDATE users SET ${column} = ?, updated_at = ? WHERE id = ?`).run(
        toAfter,
        now,
        toDocId,
      );

      // 5. Verifikasi konsistensi; bila gagal, throw -> rollback otomatis
      const vFrom = Number(
        db.prepare(`SELECT ${column} AS val FROM users WHERE id = ?`).get(fromDocId).val,
      );
      const vTo = Number(
        db.prepare(`SELECT ${column} AS val FROM users WHERE id = ?`).get(toDocId).val,
      );
      if (vFrom !== fromAfter || vTo !== toAfter) throw new Error('verification_failed');

      return { fromBefore, fromAfter, toBefore, toAfter };
    });

    const result = run();
    return { ok: true, fromDocId, toDocId, ...result };
  } catch (err) {
    // Transaction sudah di-rollback oleh better-sqlite3 saat throw
    const known = ['insufficient', 'verification_failed', 'sender_not_found', 'recipient_not_found'];
    return {
      ok: false,
      reason: known.includes(err.message) ? err.message : 'error',
      detail: err.message,
    };
  }
}

/**
 * Cek apakah user premium
 */
function isPremiumUser(remoteJid) {
  const dataUsers = findUser(remoteJid, 'debug isPremiumUser');
  if (!dataUsers) return false;

  const [docId, userData] = dataUsers;
  const premiumDate = new Date(userData.premium);
  return !isNaN(premiumDate) && premiumDate > new Date();
}

/**
 * Reset semua money ke 0
 */
async function resetMoney() {
  getStmt('resetMoney', 'UPDATE users SET money = 0, updated_at = ?').run(new Date().toISOString());
}

/**
 * Hapus member yang tidak aktif > 30 hari
 */
function resetMemberOld() {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
  const result = getStmt('deleteMemberOld', 'DELETE FROM users WHERE updated_at < ?').run(cutoff);
  return result.changes;
}

/**
 * Reset semua limit ke 0
 */
async function resetLimit() {
  getStmt('resetLimit', 'UPDATE users SET limit_count = 0, updated_at = ?').run(
    new Date().toISOString(),
  );
}

/**
 * Reset semua level ke 0
 */
async function resetLevel() {
  getStmt('resetLevel', 'UPDATE users SET level = 0, updated_at = ?').run(new Date().toISOString());
}

/**
 * Reset seluruh database users
 */
async function resetUsers() {
  getStmt('deleteAllUsers', 'DELETE FROM users').run();
}

/**
 * Reset seluruh database owners
 */
async function resetOwners() {
  getStmt('deleteAllOwners', 'DELETE FROM owners').run();
}

/**
 * User tidak aktif (> 7 hari)
 */
function getInactiveUsers() {
  const sevenDaysAgo = new Date(Date.now() - 7 * MS_IN_A_DAY).toISOString();
  const rows = getStmt(
    'inactiveUsers',
    'SELECT id, updated_at FROM users WHERE updated_at < ?',
  ).all(sevenDaysAgo);
  return rows.map((row) => ({ id: row.id, updatedAt: row.updated_at }));
}

/**
 * User aktif dalam N hari terakhir
 */
function getActiveUsers(TOTAL_HARI_SIDER) {
  const cutoff = new Date(Date.now() - TOTAL_HARI_SIDER * MS_IN_A_DAY).toISOString();
  const rows = getStmt('activeUsers', 'SELECT id, updated_at FROM users WHERE updated_at >= ?').all(
    cutoff,
  );
  return rows.map((row) => ({ id: row.id, updatedAt: row.updated_at }));
}

/**
 * Tandai user sebagai aktif (set updated_at = now()).
 *
 * Dipakai saat user mengirim pesan di grup. User yang belum terdaftar
 * akan otomatis didaftarkan agar aktivitasnya bisa dilacak.
 *
 * @param {string} jid - JID pengirim (mis. 628xxx@s.whatsapp.net)
 * @returns {boolean} true jika berhasil
 */
function markUserActive(jid) {
  if (!jid) return false;
  try {
    // findUser otomatis mendaftarkan user baru bila belum ada.
    // Hasilnya bisa berupa [docId, userData] (user lama) atau string docId (user baru).
    const result = findUser(jid, 'markUserActive');
    if (!result) return false;

    const docId = Array.isArray(result) ? result[0] : result;
    if (!docId) return false;

    getStmt('touchUpdatedAt', 'UPDATE users SET updated_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      docId,
    );
    return true;
  } catch (error) {
    console.error('❌ Error markUserActive:', error.message);
    return false;
  }
}

/**
 * Kumpulan identitas (JID + nomor) dari semua user yang aktif dalam N hari terakhir.
 * Dikembalikan sebagai Set untuk pencocokan cepat dengan participant grup.
 */
function getActiveUserIdentifiers(days) {
  const cutoff = new Date(Date.now() - days * MS_IN_A_DAY).toISOString();
  const rows = getStmt(
    'activeUserAliases',
    'SELECT aliases FROM users WHERE updated_at >= ?',
  ).all(cutoff);

  const identifiers = new Set();
  for (const row of rows) {
    const aliases = safeJsonParse(row.aliases, []);
    if (!Array.isArray(aliases)) continue;
    for (const alias of aliases) {
      if (!alias) continue;
      identifiers.add(alias); // JID mentah, mis. 628xxx@s.whatsapp.net / xxx@lid
      const number = alias.replace(/\D/g, '');
      if (number) identifiers.add(number); // bentuk nomor saja sebagai fallback
    }
  }
  return identifiers;
}

/**
 * Filter participant grup -> hanya yang TIDAK aktif (sider) selama >= `days` hari.
 *
 * Participant dianggap aktif bila salah satu identitasnya (phoneNumber atau id/lid)
 * cocok dengan user yang updated_at-nya masih dalam `days` hari terakhir.
 *
 * @param {Array} participants - participants dari group metadata
 * @param {number} days - ambang hari tidak aktif
 * @returns {Array} participant yang merupakan sider
 */
function filterSiderParticipants(participants, days) {
  const activeIds = getActiveUserIdentifiers(days);

  return (participants || []).filter((p) => {
    for (const ident of [p.phoneNumber, p.id]) {
      if (!ident) continue;
      if (activeIds.has(ident)) return false;
      const number = ident.replace(/\D/g, '');
      if (number && activeIds.has(number)) return false;
    }
    return true; // tidak ada identitas yang cocok -> sider
  });
}

// ====== OWNER FUNCTIONS ======

// In-memory cache for owner (dimuat dari SQLite)
let dbOwner = [];

function loadOwners() {
  const rows = getStmt('allOwners', 'SELECT number FROM owners').all();
  dbOwner = rows.map((r) => r.number);
}

// Load owners saat startup
loadOwners();

function generateAllOwnerIds() {
  try {
    const ownerNumbers = Array.isArray(config?.owner_number) ? config.owner_number : [];
    const dbOwnerNumbers = Array.isArray(dbOwner) ? dbOwner : [];
    const rawIds = [...ownerNumbers, ...dbOwnerNumbers];
    const allIds = new Set();

    for (const raw of rawIds) {
      if (typeof raw !== 'string' || !raw.trim()) continue;
      let base = raw.trim();

      if (base.includes('@')) {
        const parts = base.split('@');
        if (parts[0]) {
          base = parts[0];
        } else {
          continue;
        }
        allIds.add(raw.trim());
      }

      allIds.add(`${base}@s.whatsapp.net`);
      allIds.add(`${base}@lid`);
    }

    return Array.from(allIds);
  } catch (error) {
    console.error('Error in generateAllOwnerIds:', error);
    return [];
  }
}

function isOwner(remoteJid) {
  const ownerIds = generateAllOwnerIds();
  return ownerIds.includes(remoteJid);
}

/**
 * Ambil status AFK user SEKALIGUS mematikannya, dalam satu langkah.
 *
 * Dulu handler AFK membaca status, MENGIRIM pesan "kembali dari AFK", baru
 * mematikan statusnya. Dua pesan yang masuk berdekatan (atau satu pesan yang
 * dikirim ulang server) sama-sama membaca status 'afk' dan sama-sama membalas
 * — inilah penyebab balasan AFK dobel. Sekarang statusnya diklaim lebih dulu,
 * jadi hanya pemanggil PERTAMA yang mendapat datanya.
 *
 * @returns {object|null} data afk milik user, atau null bila ia tidak AFK
 */
function claimAfkReturn(id) {
  const user = resolveUser(id);
  if (!user) return null;

  const [docId, userData] = user;
  if (userData.status !== 'afk' || !userData.afk) return null;

  const hasil = getStmt(
    'clearAfk',
    "UPDATE users SET status = 'aktif', afk = ?, updated_at = ? WHERE id = ? AND status = 'afk'",
  ).run(toJson({ lastchat: 0, alasan: null }), new Date().toISOString(), docId);

  return hasil.changes > 0 ? userData.afk : null;
}

/**
 * Apakah SUDAH ada owner yang terdaftar (di config.js maupun database)?
 *
 * Dipakai untuk "mode setup" pada instalasi baru: selama DATA_OWNER masih
 * kosong, pemilik bot belum tahu LID-nya sendiri, sedangkan LID itu justru
 * syarat mengisi DATA_OWNER. Karena bot diam di grup yang belum di-.acc dan
 * (tergantung DESTINATION) bisa juga diam di chat pribadi, tanpa jalan keluar
 * ini pemilik baru tidak punya cara apa pun mengambil LID-nya lewat bot.
 */
function hasOwner() {
  return generateAllOwnerIds().length > 0;
}

function formatJid(number) {
  if (!number.includes('@')) {
    return `${number}@s.whatsapp.net`;
  }
  return number;
}

function listOwner() {
  const ownerJids = config.owner_number.map(formatJid);
  const dbJids = dbOwner.map(formatJid);

  return [...ownerJids, ...dbJids];
}
function addOwner(number) {
  if (dbOwner.includes(number)) return false;
  try {
    getStmt('insertOwner', 'INSERT OR IGNORE INTO owners (number) VALUES (?)').run(number);
    dbOwner.push(number);
    return true;
  } catch {
    return false;
  }
}

function delOwner(number) {
  const index = dbOwner.indexOf(number);
  if (index === -1) return false;
  getStmt('deleteOwner', 'DELETE FROM owners WHERE number = ?').run(number);
  dbOwner.splice(index, 1);
  return true;
}

// ====== Dummy save functions (no-op karena SQLite auto-persist) ======
async function saveUsers() {
  /* no-op: SQLite auto-persist */
}
async function saveOwners() {
  /* no-op: SQLite auto-persist */
}

// Backward-compatible db & dbOwner exports
// Catatan: db export sebagai getter agar selalu sinkron
const db = new Proxy(
  {},
  {
    get(target, prop) {
      // Baca dari SQLite real-time
      const rows = getStmt('allUsersFull', 'SELECT * FROM users').all();
      const result = {};
      for (const row of rows) {
        result[row.id] = rowToUser(row);
      }
      return result[prop];
    },
    set(target, prop, value) {
      // Set ke SQLite — update jika sudah ada, insert jika belum
      if (value && typeof value === 'object') {
        const existing = getStmt('getById', 'SELECT id FROM users WHERE id = ?').get(prop);
        if (existing) {
          updateUser(prop, value);
        } else {
          addUser(prop, value);
        }
      }
      return true;
    },
    has(target, prop) {
      const row = getStmt('getById', 'SELECT id FROM users WHERE id = ?').get(prop);
      return !!row;
    },
    ownKeys() {
      const rows = getStmt('allIds', 'SELECT id FROM users').all();
      return rows.map((r) => r.id);
    },
    getOwnPropertyDescriptor(target, prop) {
      const row = getStmt('getById', 'SELECT id FROM users WHERE id = ?').get(prop);
      if (row) {
        return { configurable: true, enumerable: true, value: rowToUser(row) };
      }
      return undefined;
    },
  },
);

/**
 * Ambil semua user yang punya data ulang tahun
 */
function getAllUsersWithBirthday() {
  const rows = getStmt('usersWithBirthday', 'SELECT * FROM users WHERE birthday IS NOT NULL').all();
  return rows.map((row) => [row.id, rowToUser(row)]);
}

export {
  readUsers,
  addUser,
  updateUser,
  deleteUser,
  findUser,
  resolveUser,
  resolveUserAny,
  transferBalance,
  getInactiveUsers,
  getActiveUsers,
  markUserActive,
  getActiveUserIdentifiers,
  filterSiderParticipants,
  isPremiumUser,
  isOwner,
  hasOwner,
  claimAfkReturn,
  linkUserLid,
  listOwner,
  addOwner,
  delOwner,
  saveUsers,
  saveOwners,
  resetUsers,
  resetOwners,
  resetMoney,
  resetLimit,
  resetLevel,
  resetMemberOld,
  registerUser,
  isUserRegistered,
  getAllUsersWithBirthday,
  db,
  dbOwner,
};
