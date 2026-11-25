/**
 * ultahGrup.js - Data ulang tahun PER GRUP.
 *
 * Dulu tanggal ulang tahun disimpan di record user (global), sehingga:
 *  - ulang tahun yang didaftarkan di grup A ikut tampil di .listultah grup B
 *    (asal orangnya anggota kedua grup),
 *  - .resetultah di grup A ikut menghapus ulang tahun orang itu di grup B.
 *
 * Sekarang setiap grup punya datanya sendiri (tabel group_birthdays) dan tidak
 * ada hubungan sama sekali antara satu grup dengan grup lain.
 *
 * Identitas disimpan sebagai NOMOR TELANJANG (tanpa @domain/device), karena
 * peserta grup bisa dikenali lewat LID maupun nomor HP tergantung grupnya.
 */

import { getDb, initDatabase } from './database.js';
import { nomorDari } from './cache.js';
import { getAllUsersWithBirthday } from './users.js';

initDatabase();

const stmtCache = {};
function getStmt(key, sql) {
  if (!stmtCache[key]) stmtCache[key] = getDb().prepare(sql);
  return stmtCache[key];
}

/** Ubah daftar jid/nomor menjadi nomor telanjang yang unik. */
const keNomor = (ids) => [...new Set((ids || []).map(nomorDari).filter(Boolean))];

/** Nomor HP (bukan LID) dari daftar identitas, bila ada. */
function nomorHp(ids) {
  const hp = (ids || []).find((id) => typeof id === 'string' && id.endsWith('@s.whatsapp.net'));
  return hp ? nomorDari(hp) : null;
}

/**
 * Cari data ulang tahun seseorang DI GRUP INI.
 * @param {string[]} ids semua identitas orangnya (sender, senderLid, ...)
 */
function cariUltah(groupId, ids) {
  const nomor = keNomor(ids);
  if (!groupId || !nomor.length) return null;
  const tanda = nomor.map(() => '?').join(',');
  return (
    getDb()
      .prepare(
        `SELECT * FROM group_birthdays WHERE group_id = ? AND (user_num IN (${tanda}) OR phone_num IN (${tanda})) LIMIT 1`,
      )
      .get(groupId, ...nomor, ...nomor) || null
  );
}

/**
 * Simpan / perbarui ulang tahun seseorang untuk grup ini saja.
 * @param {string[]} ids identitas orangnya; yang pertama jadi kunci utama
 * @returns {{diperbarui: boolean}}
 */
function simpanUltah(groupId, ids, birthday, birthYear) {
  const lama = cariUltah(groupId, ids);
  const phone = nomorHp(ids);

  if (lama) {
    // Tanggal baru = ucapan tahun ini boleh terkirim lagi bila tanggalnya beda.
    const lastWish = lama.birthday === birthday ? lama.last_wish : null;
    getStmt(
      'update',
      `UPDATE group_birthdays SET birthday = ?, birth_year = ?, last_wish = ?,
         phone_num = COALESCE(?, phone_num) WHERE group_id = ? AND user_num = ?`,
    ).run(birthday, birthYear ?? null, lastWish, phone, groupId, lama.user_num);
    return { diperbarui: true };
  }

  const kunci = keNomor(ids)[0];
  getStmt(
    'insert',
    `INSERT INTO group_birthdays (group_id, user_num, phone_num, birthday, birth_year)
       VALUES (?, ?, ?, ?, ?)`,
  ).run(groupId, kunci, phone, birthday, birthYear ?? null);
  return { diperbarui: false };
}

/** Semua ulang tahun yang terdaftar di grup ini. */
function daftarUltahGrup(groupId) {
  return getStmt('list', 'SELECT * FROM group_birthdays WHERE group_id = ?').all(groupId);
}

/** Hapus ulang tahun di grup ini SAJA. @returns {number} jumlah yang dihapus */
function hapusUltahGrup(groupId) {
  // Grup tetap ditandai "sudah dipindahkan" supaya data lama (global) tidak
  // muncul kembali setelah di-reset.
  getStmt('markMigrated', 'INSERT OR IGNORE INTO group_birthdays_migrated (group_id) VALUES (?)').run(
    groupId,
  );
  return getStmt('deleteGroup', 'DELETE FROM group_birthdays WHERE group_id = ?').run(groupId).changes;
}

/** Hapus SEMUA ulang tahun di semua grup (owner: .resetultah all). */
function hapusUltahSemua() {
  return getStmt('deleteAll', 'DELETE FROM group_birthdays').run().changes;
}

/** Tandai ucapan ulang tahun sudah dikirim di grup ini. */
function tandaiUcapan(groupId, userNum, kunci) {
  getStmt('wish', 'UPDATE group_birthdays SET last_wish = ? WHERE group_id = ? AND user_num = ?').run(
    kunci,
    groupId,
    userNum,
  );
}

/* ------------------------- pemindahan data lama ------------------------- */

const sudahDipindah = new Set();

/**
 * Pindahkan data ulang tahun LAMA (global, tabel users) ke grup ini, SEKALI
 * per grup: hanya untuk orang yang saat itu anggota grup ini. Setelahnya data
 * grup berdiri sendiri — reset / perubahan di grup lain tidak berpengaruh.
 *
 * @param {object[]} participants peserta grup dari metadata
 */
function pindahkanDataLama(groupId, participants) {
  if (!groupId || sudahDipindah.has(groupId)) return;
  if (!Array.isArray(participants) || !participants.length) return; // coba lagi nanti

  const sudah = getStmt('isMigrated', 'SELECT 1 FROM group_birthdays_migrated WHERE group_id = ?').get(
    groupId,
  );
  if (sudah) {
    sudahDipindah.add(groupId);
    return;
  }

  const anggota = new Set(
    participants.flatMap((p) => [p.phoneNumber, p.id, p.jid, p.lid]).map(nomorDari).filter(Boolean),
  );

  const insert = getStmt(
    'insertLegacy',
    `INSERT OR IGNORE INTO group_birthdays (group_id, user_num, phone_num, birthday, birth_year, last_wish)
       VALUES (?, ?, ?, ?, ?, ?)`,
  );

  getDb().transaction(() => {
    for (const [id, user] of getAllUsersWithBirthday() || []) {
      if (!user?.birthday) continue;
      const ids = [id, ...(Array.isArray(user.aliases) ? user.aliases : [])];
      const nomor = keNomor(ids);
      if (!nomor.some((n) => anggota.has(n))) continue;
      if (cariUltah(groupId, ids)) continue;

      insert.run(
        groupId,
        nomor[0],
        nomorHp(ids),
        user.birthday,
        user.birthYear ?? null,
        user.lastBirthdayWish != null ? String(user.lastBirthdayWish) : null,
      );
    }
    getStmt('markMigrated', 'INSERT OR IGNORE INTO group_birthdays_migrated (group_id) VALUES (?)').run(
      groupId,
    );
  })();

  sudahDipindah.add(groupId);
}

export {
  cariUltah,
  simpanUltah,
  daftarUltahGrup,
  hapusUltahGrup,
  hapusUltahSemua,
  tandaiUcapan,
  pindahkanDataLama,
};
