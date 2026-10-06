/**
 * repair.js - Pemulihan baris Signal store yang rusak.
 *
 * Latar belakang:
 * Kunci enkripsi grup (sender key) dan sesi Signal per-perangkat disimpan di
 * `zapo.sqlite` sebagai blob protobuf. Kalau SATU baris isinya rusak, zapo
 * melempar error protobuf mentah — mis. `invalid wire type 6 at offset 14` —
 * setiap kali bot mencoba MENGIRIM ke chat yang memakai baris itu:
 *
 *   sock.sendMessage(grup)
 *     -> SenderKeyManager.ensureSenderKey(grup, kita)
 *        -> store.getDeviceSenderKey(...)
 *           -> proto.SenderKeyRecordStructure.decode(record)  <-- meledak
 *
 * Gejalanya menipu: command apa pun (.id, .menu, .ping) gagal, TAPI hanya di
 * grup tertentu — yaitu grup yang barisnya rusak. Jadi yang terlihat salah
 * adalah plugin terakhir yang dipakai, padahal plugin-nya tidak bersalah.
 *
 * Tanpa pemulihan, grup itu rusak PERMANEN: tidak ada kode di zapo yang
 * membuang baris busuk, jadi percobaan kirim berikutnya meledak di titik yang
 * sama selamanya. Modul ini memindai kedua tabel, membuang HANYA baris yang
 * memang gagal didekode, lalu membiarkan zapo membuatnya ulang dari nol
 * (sender key dibuat baru, sesi Signal dinegosiasi ulang lewat prekey).
 */

import fs from 'fs';
import Database from 'better-sqlite3';
import { decodeSenderKeyRecord, decodeSignalSessionRecord } from 'zapo-js/signal';
import { sessionDbPath } from './store.js';

/**
 * Error dekode protobuf dari store Signal.
 *
 * Pesannya datang apa adanya dari protobufjs (`invalid wire type ...`) atau
 * dari lapisan coercion zapo (`invalid bytes value for sender_keys.record`),
 * jadi dikenali dari teksnya — zapo tidak memberi kode error khusus.
 */
const POLA_RUSAK =
  /invalid wire type|index out of range|invalid varint|buffer overrun|invalid bytes value for (sender_keys|signal_sessions)\.record|missing sender_keys\.record|missing signal_sessions\.record/i;

/** True kalau error ini bergejala "ada baris store yang busuk". */
export function isSignalStoreCorruptError(error) {
  return POLA_RUSAK.test(String(error?.message ?? error ?? ''));
}

/** Buka file sqlite sesi READ-ONLY, supaya tidak berebut tulis dengan store. */
function bukaReadOnly(sessionDir) {
  const file = sessionDbPath(sessionDir);
  if (!fs.existsSync(file)) return null;

  const db = new Database(file, { readonly: true, fileMustExist: true });
  db.pragma('busy_timeout = 5000');
  return db;
}

/**
 * Pindai tabel `sender_keys` dan `signal_session`, kembalikan baris yang
 * gagal didekode.
 *
 * Pemindaian dilakukan lewat koneksi sqlite TERPISAH (read-only) karena API
 * store zapo tidak punya cara menyebut "semua baris" tanpa ikut mendekodenya —
 * dan itu justru yang meledak.
 *
 * @returns {{senderKeys: Array, sessions: Array}}
 */
export function scanCorruptSignalRows(sessionDir, sessionId = 'default') {
  const hasil = { senderKeys: [], sessions: [] };
  const db = bukaReadOnly(sessionDir);
  if (!db) return hasil;

  try {
    const senderRows = db
      .prepare(
        `SELECT group_id, sender_user, sender_server, sender_device, record
           FROM sender_keys WHERE session_id = ?`,
      )
      .all(sessionId);

    for (const row of senderRows) {
      const address = {
        user: row.sender_user,
        server: row.sender_server,
        device: row.sender_device,
      };
      try {
        decodeSenderKeyRecord(row.record, row.group_id, address);
      } catch (error) {
        hasil.senderKeys.push({ groupId: row.group_id, address, alasan: error?.message || String(error) });
      }
    }

    const sessionRows = db
      .prepare(
        `SELECT user, server, device, record FROM signal_session WHERE session_id = ?`,
      )
      .all(sessionId);

    for (const row of sessionRows) {
      const address = { user: row.user, server: row.server, device: row.device };
      try {
        decodeSignalSessionRecord(row.record);
      } catch (error) {
        hasil.sessions.push({ address, alasan: error?.message || String(error) });
      }
    }
  } finally {
    db.close();
  }

  return hasil;
}

/** `{user, server, device}` -> teks pendek untuk log. */
function tulisAlamat(address) {
  return `${address.user}@${address.server}:${address.device}`;
}

/**
 * Buang baris store yang rusak.
 *
 * Penghapusannya lewat API store (bukan SQL langsung) supaya cache L1 di depan
 * sqlite ikut dibersihkan — kalau tidak, baris busuk bisa terbaca lagi dari
 * memori sampai bot direstart.
 *
 * @param {object} storeSession hasil `store.session('default')`
 * @param {string} sessionDir folder sesi (tempat zapo.sqlite berada)
 * @returns {Promise<{senderKeys: number, sessions: number}>} jumlah yang dibuang
 */
export async function purgeCorruptSignalRows(storeSession, sessionDir, log = console.warn) {
  const rusak = scanCorruptSignalRows(sessionDir);
  let senderKeys = 0;
  let sessions = 0;

  for (const item of rusak.senderKeys) {
    try {
      await storeSession.senderKey.deleteDeviceSenderKey(item.address, item.groupId);
      senderKeys++;
      log(`[STORE RUSAK] sender key dibuang: ${item.groupId} / ${tulisAlamat(item.address)} - ${item.alasan}`);
    } catch (error) {
      log(`[STORE RUSAK] gagal membuang sender key ${item.groupId}: ${error?.message || error}`);
    }
  }

  for (const item of rusak.sessions) {
    try {
      await storeSession.session.deleteSession(item.address);
      sessions++;
      log(`[STORE RUSAK] sesi Signal dibuang: ${tulisAlamat(item.address)} - ${item.alasan}`);
    } catch (error) {
      log(`[STORE RUSAK] gagal membuang sesi ${tulisAlamat(item.address)}: ${error?.message || error}`);
    }
  }

  return { senderKeys, sessions };
}
