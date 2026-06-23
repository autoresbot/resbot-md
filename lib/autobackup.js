/**
 * autobackup.js - Fitur AUTO_BACKUP.
 *
 * Jika config.autobackup === true:
 *   - Jalankan backup saat startup (bot online).
 *   - Jalankan backup berkala setiap 4 jam.
 * Hasil backup dikirim otomatis ke owner memakai sumber logika tunggal
 * (createAndSendBackup di lib/backupService.js).
 *
 * Error handling: kegagalan backup dicatat namun tidak menyebabkan crash,
 * dan scheduler tetap berjalan meskipun backup sebelumnya gagal.
 */

import config from '../config.js';
import { createAndSendBackup } from './backupService.js';

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

let initialized = false; // cegah duplikasi saat reconnect dalam satu proses
let scheduler = null;

/**
 * Jalankan satu siklus backup dengan logging sesuai jenisnya.
 * Selalu menangkap error agar tidak meng-crash bot / menghentikan scheduler.
 */
async function runBackup(sock, { type, startLog, successLog }) {
  console.log(startLog);
  try {
    await createAndSendBackup(sock, { type });
    console.log(successLog);
    console.log('[AUTO_BACKUP] Backup sent to owner');
  } catch (err) {
    console.error(`[AUTO_BACKUP] Error: ${err?.message || err}`);
  }
}

/**
 * Inisialisasi AUTO_BACKUP. Aman dipanggil berkali-kali (mis. tiap reconnect):
 * startup backup & scheduler hanya dipasang sekali per proses.
 *
 * @param {object} sock - socket Baileys (sesi utama)
 */
function initAutoBackup(sock) {
  if (!config.autobackup) return; // AUTO_BACKUP === false -> tidak melakukan apa pun
  if (initialized) return;
  initialized = true;

  // 1) Backup saat startup
  runBackup(sock, {
    type: 'Startup',
    startLog: '[AUTO_BACKUP] Startup backup started',
    successLog: '[AUTO_BACKUP] Startup backup success',
  });

  // 2) Backup berkala setiap 4 jam
  scheduler = setInterval(() => {
    runBackup(sock, {
      type: 'Scheduled 4 Hour Backup',
      startLog: '[AUTO_BACKUP] Scheduled backup started',
      successLog: '[AUTO_BACKUP] Scheduled backup success',
    });
  }, FOUR_HOURS_MS);

  // Jangan menahan proses tetap hidup hanya karena timer ini
  if (typeof scheduler.unref === 'function') scheduler.unref();
}

export { initAutoBackup };
