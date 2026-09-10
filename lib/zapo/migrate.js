/**
 * Migrasi auth state Baileys (folder `creds.json` + `*.json`) ke store zapo.
 *
 * Tujuannya supaya bot yang sudah jalan TIDAK perlu scan QR / pairing ulang:
 * identitas device dan seluruh sesi Signal dengan tiap peer ikut terbawa.
 * Konversi ini murni transformasi data — `wa-store-migrate` tidak membuka
 * socket dan tidak menyentuh WhatsApp.
 */

import fs from 'fs';
import path from 'path';
import { migrate, bufferJsonReviver } from 'wa-store-migrate';
import { createSessionStore, hasBaileysCreds, hasZapoStore, SQLITE_FILENAME } from './store.js';

/** Baca folder auth Baileys jadi snapshot `{ creds, keys }`. */
function readBaileysMultiFile(dir) {
  const creds = JSON.parse(fs.readFileSync(path.join(dir, 'creds.json'), 'utf-8'), bufferJsonReviver);
  const keys = {};

  for (const file of fs.readdirSync(dir)) {
    if (file === 'creds.json' || !file.endsWith('.json')) continue;
    const matched = /^([a-z-]+)-(.+)\.json$/i.exec(file);
    if (!matched) continue;

    // Nama file Baileys meng-escape '/' jadi '__' dan ':' jadi '-'.
    const id = matched[2].replace(/__/g, '/').replace(/-/g, ':');
    (keys[matched[1]] ??= {})[id] = JSON.parse(
      fs.readFileSync(path.join(dir, file), 'utf-8'),
      bufferJsonReviver,
    );
  }

  return { creds, keys };
}

/** Tulis hasil konversi ke store zapo. */
async function writeSnapshot(store, data) {
  const session = store.session('default');

  await session.auth.save(data.credentials);

  for (const preKey of data.preKeys ?? []) {
    await session.preKey.putPreKey(preKey);
  }

  if (data.identities?.length) {
    await session.identity.setRemoteIdentities(
      data.identities.map((i) => ({ address: i.address, identityKey: i.identityKey })),
    );
  }

  if (data.sessions?.length) {
    await session.session.setSessionsBatch(
      data.sessions.map((s) => ({ address: s.address, session: s.record })),
    );
  }

  for (const senderKey of data.senderKeys ?? []) {
    await session.senderKey.upsertSenderKey(senderKey.record);
  }

  if (data.appState?.keys?.length) {
    await session.appState.upsertSyncKeys(data.appState.keys);
  }

  if (data.privacyTokens?.length) {
    await session.privacyToken.upsertBatch(data.privacyTokens);
  }
}

/**
 * Migrasikan satu folder sesi bila perlu.
 *
 * @returns {Promise<'migrated'|'already-migrated'|'no-baileys-session'>}
 */
export async function migrateSessionIfNeeded(sessionDir, log = console.log) {
  if (hasZapoStore(sessionDir)) return 'already-migrated';
  if (!hasBaileysCreds(sessionDir)) return 'no-baileys-session';

  // Salin auth Baileys ke folder terpisah SEBELUM apa pun disentuh.
  // Menyimpannya di dalam folder sesi tidak aman: begitu store zapo aktif,
  // isi folder itu bisa terhapus oleh logout paksa dari server atau oleh
  // perintah pembersih sesi, dan satu-satunya jalan pulang ikut hilang.
  const backupDir = backupBaileysAuth(sessionDir, log);

  log(`[MIGRASI] Mengonversi sesi Baileys di ${sessionDir} ...`);

  const snapshot = readBaileysMultiFile(sessionDir);
  const { data, losses } = migrate({ from: 'baileys', to: 'zapo', data: snapshot });

  for (const loss of losses) {
    log(`[MIGRASI] ${loss.severity} ${loss.domain} x${loss.count}: ${loss.reason}`);
  }

  const store = createSessionStore(sessionDir);
  await writeSnapshot(store, data);

  log(`[MIGRASI] Selesai. Cadangan auth Baileys: ${backupDir}`);
  return 'migrated';
}

/**
 * Salin `creds.json` + seluruh `*.json` Baileys ke folder cadangan di luar
 * folder sesi. Dikembalikan path-nya untuk dicatat di log.
 */
function backupBaileysAuth(sessionDir, log) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const parent = path.dirname(path.resolve(sessionDir));
  const backupDir = path.join(parent, `${path.basename(sessionDir)}-baileys-backup-${stamp}`);

  fs.mkdirSync(backupDir, { recursive: true });

  let copied = 0;
  for (const file of fs.readdirSync(sessionDir)) {
    if (!file.endsWith('.json')) continue;
    fs.copyFileSync(path.join(sessionDir, file), path.join(backupDir, file));
    copied++;
  }

  log(`[MIGRASI] ${copied} file auth Baileys dicadangkan ke ${backupDir}`);
  return backupDir;
}

/**
 * Kembalikan sesi Baileys dari folder cadangan ke folder sesi, lalu buang store
 * zapo supaya migrasi diulang dari awal saat bot dijalankan lagi.
 *
 * Dipakai manual kalau migrasi gagal — lihat perubahan.md bagian 5.
 */
export function restoreBaileysBackup(backupDir, sessionDir) {
  if (!fs.existsSync(backupDir)) {
    throw new Error(`Folder cadangan tidak ditemukan: ${backupDir}`);
  }

  fs.mkdirSync(sessionDir, { recursive: true });

  // Buang store zapo dulu, termasuk file WAL/SHM-nya.
  for (const file of fs.readdirSync(sessionDir)) {
    if (file.startsWith(SQLITE_FILENAME)) {
      fs.rmSync(path.join(sessionDir, file), { force: true });
    }
  }

  let restored = 0;
  for (const file of fs.readdirSync(backupDir)) {
    fs.copyFileSync(path.join(backupDir, file), path.join(sessionDir, file));
    restored++;
  }

  return restored;
}
