/**
 * autobackup.js - Fitur AUTO_BACKUP.
 *
 * Jika config.autobackup === true:
 *   - Jalankan backup saat startup (bot online).
 *   - Jalankan backup berkala setiap 4 jam.
 *
 * Hasil backup dikirim otomatis ke owner memakai sumber logika tunggal
 * (createAndSendBackup di lib/backupService.js). Bila config.autobackup_telegram
 * juga true dan TELEGRAM sudah diisi, file yang sama dikirim ke Telegram.
 *
 * Error handling: kegagalan backup dicatat dengan penyebab & solusi yang jelas,
 * tidak menyebabkan crash, dan scheduler tetap berjalan meski backup sebelumnya
 * gagal. Kegagalan juga dilaporkan ke owner lewat WhatsApp (sekali per siklus,
 * bukan spam) agar tidak diam-diam berhenti berjalan.
 */

import config from '../config.js';
import { createAndSendBackup } from './backupService.js';
import {
  createAndSendTelegramBackup,
  isTelegramConfigured,
  jelaskanErrorTelegram,
} from './telegramBackup.js';
import { STAGE, buildErrorMessage, jelaskanErrorWa } from './backupErrors.js';
import { resolveSendableJid } from './utils.js';
import { listOwner } from './users.js';
import { logCustom } from './logger.js';

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

let initialized = false; // cegah duplikasi saat reconnect dalam satu proses
let scheduler = null;
let running = false; // cegah dua siklus backup berjalan bersamaan

/**
 * Kabari owner pertama bila AUTO_BACKUP gagal, supaya kegagalan tidak
 * hanya berhenti di log server. Sengaja hanya SATU nomor agar aman dari
 * pola pengiriman yang dinilai mencurigakan oleh WhatsApp.
 */
async function laporGagalKeOwner(sock, teks) {
  try {
    const owner = (listOwner() || [])[0];
    if (!owner) return;
    const jid = await resolveSendableJid(sock, owner);
    if (!jid) return;
    await sock.sendMessage(jid, { text: teks });
  } catch (err) {
    console.error(`[AUTO_BACKUP] Gagal melapor ke owner: ${err?.message || err}`);
  }
}

/**
 * Backup ke Telegram (opsional). Kegagalannya tidak menggagalkan siklus,
 * hanya dicatat dan dilaporkan.
 */
async function backupKeTelegram(type) {
  if (!config.autobackup_telegram) return null;

  if (!isTelegramConfigured()) {
    console.warn(
      '[AUTO_BACKUP] AUTO_BACKUP_TELEGRAM aktif tapi TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID di config.js masih kosong - dilewati.',
    );
    return null;
  }

  try {
    await createAndSendTelegramBackup({ type });
    console.log('[AUTO_BACKUP] Backup terkirim ke Telegram');
    return null;
  } catch (err) {
    const info = jelaskanErrorTelegram(err, STAGE.UPLOAD);
    console.error(`[AUTO_BACKUP][TELEGRAM] ${info.stage}: ${info.sebab}`);
    logCustom(
      'error',
      `[AUTO_BACKUP][TELEGRAM][${info.stage}] ${info.sebab} | ${info.teknis || '-'}`,
      'ERROR-COMMAND-backuptele.txt',
    );
    return buildErrorMessage(info, '❌ *AUTO BACKUP ke Telegram GAGAL*');
  }
}

/**
 * Jalankan satu siklus backup dengan logging sesuai jenisnya.
 * Selalu menangkap error agar tidak meng-crash bot / menghentikan scheduler.
 */
async function runBackup(sock, { type, startLog, successLog }) {
  if (running) {
    console.warn('[AUTO_BACKUP] Siklus sebelumnya masih berjalan - dilewati.');
    return;
  }
  running = true;

  console.log(startLog);
  try {
    const { terkirim, gagal } = await createAndSendBackup(sock, { type });
    console.log(successLog);
    console.log(`[AUTO_BACKUP] Terkirim ke ${terkirim.length} nomor owner`);

    for (const item of gagal) {
      console.warn(`[AUTO_BACKUP] Gagal ke ${item.jid}: ${item.sebab}`);
    }
  } catch (err) {
    const info = jelaskanErrorWa(err, STAGE.BACKUP);
    console.error(`[AUTO_BACKUP] ${info.stage}: ${info.sebab}`);
    logCustom(
      'error',
      `[AUTO_BACKUP][${info.stage}] ${info.sebab} | ${info.teknis || '-'}`,
      'ERROR-COMMAND-backup.txt',
    );
    await laporGagalKeOwner(sock, buildErrorMessage(info, '❌ *AUTO BACKUP GAGAL*'));
  }

  const pesanTelegramGagal = await backupKeTelegram(type);
  if (pesanTelegramGagal) await laporGagalKeOwner(sock, pesanTelegramGagal);

  running = false;
}

/**
 * Inisialisasi AUTO_BACKUP. Aman dipanggil berkali-kali (mis. tiap reconnect):
 * startup backup & scheduler hanya dipasang sekali per proses.
 *
 * @param {object} sock - socket bot (sesi utama)
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
