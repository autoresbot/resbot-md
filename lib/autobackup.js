/**
 * autobackup.js - Fitur AUTO_BACKUP.
 *
 * Jika config.autobackup === true:
 *   - Jalankan backup saat startup (bot online).
 *   - Jalankan backup berkala setiap 4 jam.
 *
 * File backup dikirim HANYA ke Telegram (createAndSendTelegramBackup di
 * lib/telegramBackup.js), tidak ke WhatsApp: mengirim file besar ke nomor owner
 * tiap restart + tiap 4 jam memenuhi chat dan menambah risiko akun dibatasi.
 * Backup manual ke WhatsApp tetap ada lewat perintah .backup.
 *
 * Error handling: kegagalan backup dicatat dengan penyebab & solusi yang jelas,
 * tidak menyebabkan crash, dan scheduler tetap berjalan meski backup sebelumnya
 * gagal. Kegagalan dilaporkan ke owner lewat pesan TEKS WhatsApp (bukan file)
 * agar tidak diam-diam berhenti berjalan.
 */

import config from '../config.js';
import {
  createAndSendTelegramBackup,
  isTelegramConfigured,
  jelaskanErrorTelegram,
} from './telegramBackup.js';
import { STAGE, buildErrorMessage } from './backupErrors.js';
import { resolveSendableJid } from './utils.js';
import { listOwner } from './users.js';
import { logCustom } from './logger.js';

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

let initialized = false; // cegah duplikasi saat reconnect dalam satu proses
let scheduler = null;
let running = false; // cegah dua siklus backup berjalan bersamaan
let sudahDiperingatkan = false; // peringatan "Telegram belum diisi" cukup sekali

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
 * Jalankan satu siklus backup ke Telegram dengan logging sesuai jenisnya.
 * Selalu menangkap error agar tidak meng-crash bot / menghentikan scheduler.
 */
async function runBackup(sock, { type, startLog, successLog }) {
  if (running) {
    console.warn('[AUTO_BACKUP] Siklus sebelumnya masih berjalan - dilewati.');
    return;
  }

  // Telegram belum diisi: tidak ada tujuan. Owner dikabari SEKALI saja per
  // proses, supaya tidak mengira backup otomatisnya berjalan.
  if (!isTelegramConfigured()) {
    console.warn(
      '[AUTO_BACKUP] Dilewati: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID di config.js masih kosong.',
    );
    if (!sudahDiperingatkan) {
      sudahDiperingatkan = true;
      await laporGagalKeOwner(
        sock,
        [
          '⚠️ *AUTO BACKUP tidak berjalan*',
          '',
          'Auto backup sekarang hanya dikirim ke Telegram, tetapi token / chat id Telegram belum diisi di config.js.',
          '',
          'Ketik *.backuptele* untuk melihat cara mengisinya. Backup manual ke WhatsApp tetap bisa lewat *.backup*.',
        ].join('\n'),
      );
    }
    return;
  }

  running = true;
  console.log(startLog);
  try {
    await createAndSendTelegramBackup({ type });
    console.log(successLog);
    console.log('[AUTO_BACKUP] Backup terkirim ke Telegram');
  } catch (err) {
    const info = jelaskanErrorTelegram(err, STAGE.UPLOAD);
    console.error(`[AUTO_BACKUP] ${info.stage}: ${info.sebab}`);
    logCustom(
      'error',
      `[AUTO_BACKUP][TELEGRAM][${info.stage}] ${info.sebab} | ${info.teknis || '-'}`,
      'ERROR-COMMAND-backuptele.txt',
    );
    await laporGagalKeOwner(sock, buildErrorMessage(info, '❌ *AUTO BACKUP ke Telegram GAGAL*'));
  } finally {
    running = false;
  }
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
