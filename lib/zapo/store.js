/**
 * Store zapo-js untuk satu sesi.
 *
 * Baileys memakai `useMultiFileAuthState(dir)` — satu folder penuh file JSON.
 * zapo memakai store yang pluggable; di sini dipakai SQLite supaya tetap
 * berbasis file (satu file per sesi, di dalam folder sesi yang sama seperti
 * sebelumnya) dan tidak menambah dependency server database.
 */

import fs from 'fs';
import path from 'path';
import { createStore } from 'zapo-js';
import { createSqliteStore } from '@zapo-js/store-sqlite';

export const SQLITE_FILENAME = 'zapo.sqlite';

/** Path file sqlite untuk sebuah folder sesi. */
export function sessionDbPath(sessionDir) {
  return path.join(sessionDir, SQLITE_FILENAME);
}

/**
 * Membuat store zapo untuk folder sesi tertentu.
 *
 * `messages` dan `contacts` di-`'none'`: bot ini tidak pernah membaca riwayat
 * pesan dari store, ia memproses pesan langsung dari event. Menyalakannya hanya
 * menumbuhkan file sqlite tanpa dipakai.
 *
 * `threads` DINYALAKAN karena `.clearchat` butuh daftar chat (dulu dibaca dari
 * `sock.chats` milik Baileys). Isinya ringan — satu baris per chat.
 */
export function createSessionStore(sessionDir) {
  fs.mkdirSync(sessionDir, { recursive: true });

  return createStore({
    backends: {
      sqlite: createSqliteStore({ path: sessionDbPath(sessionDir), driver: 'auto' }),
    },
    providers: {
      auth: 'sqlite',
      signal: 'sqlite',
      preKey: 'sqlite',
      session: 'sqlite',
      identity: 'sqlite',
      senderKey: 'sqlite',
      appState: 'sqlite',
      privacyToken: 'sqlite',
      messages: 'none',
      threads: 'sqlite',
      contacts: 'none',
    },
  });
}

/** True kalau folder sesi sudah punya store zapo. */
export function hasZapoStore(sessionDir) {
  return fs.existsSync(sessionDbPath(sessionDir));
}

/** True kalau folder sesi masih berisi auth state Baileys (creds.json). */
export function hasBaileysCreds(sessionDir) {
  return fs.existsSync(path.join(sessionDir, 'creds.json'));
}
