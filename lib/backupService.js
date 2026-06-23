/**
 * backupService.js - Sumber tunggal logika backup.
 *
 * Dipakai bersama oleh:
 *   - Plugin .backup (plugins/OWNER/backup.js)
 *   - Fitur AUTO_BACKUP (lib/autobackup.js)
 *
 * Tujuannya menghindari duplikasi kode: pembuatan file backup tetap memakai
 * createBackup() di lib/utils.js, sedangkan pengiriman dokumen ke owner/bot
 * dipusatkan di sini.
 */

import moment from 'moment-timezone';
import config from '../config.js';
import { createBackup, resolveSendableJid } from './utils.js';
import { listOwner } from './users.js';

const BACKUP_FILENAME = 'autoresbot-backup.zip';
const BACKUP_MIMETYPE = 'application/zip';

/**
 * Susun caption dokumen backup (tanggal, ukuran bila tersedia, jenis backup).
 */
function buildCaption(backup, type) {
  const tanggal = moment.tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm:ss');
  const lines = ['🗄️ *Backup Data*', `📅 Tanggal : ${tanggal}`];
  if (backup?.size) lines.push(`📦 Ukuran : ${backup.size}`);
  lines.push(`🏷️ Jenis : ${type}`);
  return lines.join('\n');
}

/**
 * Daftar tujuan pengiriman backup: nomor bot (opsional) + semua owner, unik.
 *
 * Tiap identifier diresolusi ke JID nomor yang valid via resolveSendableJid,
 * sehingga owner yang dikonfigurasi sebagai LID tidak menyebabkan error 401
 * (WhatsApp hanya bisa kirim ke JID nomor, bukan @lid).
 */
async function buildTargets(sock, includeBot) {
  const rawIds = [];
  if (includeBot && config.phone_number_bot) rawIds.push(config.phone_number_bot);
  for (const owner of listOwner() || []) {
    if (owner) rawIds.push(owner);
  }

  const targets = [];
  for (const id of rawIds) {
    const jid = await resolveSendableJid(sock, id);
    if (jid && !targets.includes(jid)) targets.push(jid);
  }
  return targets;
}

/**
 * Buat file backup lalu kirim sebagai dokumen ke nomor bot & semua owner.
 *
 * @param {object} sock - socket Baileys
 * @param {object} [options]
 * @param {string} [options.type='Manual'] - jenis backup untuk caption
 * @param {boolean} [options.includeBot=true] - sertakan nomor bot sebagai tujuan
 * @returns {Promise<{path:string,size:string,time:string}>} info backup
 * @throws bila pembuatan file backup gagal (kegagalan kirim per-tujuan tidak dilempar)
 */
async function createAndSendBackup(sock, options = {}) {
  const { type = 'Manual', includeBot = true } = options;

  // Pembuatan file backup (jika gagal, dilempar ke pemanggil untuk ditangani)
  const backup = await createBackup();

  const message = {
    document: { url: backup.path },
    fileName: BACKUP_FILENAME,
    mimetype: BACKUP_MIMETYPE,
    caption: buildCaption(backup, type),
  };

  // Kirim ke tiap tujuan; kegagalan satu tujuan tidak menghentikan tujuan lain
  const targets = await buildTargets(sock, includeBot);
  for (const jid of targets) {
    try {
      await sock.sendMessage(jid, message);
    } catch (err) {
      console.error(`[BACKUP] Gagal kirim ke ${jid}: ${err.message}`);
    }
  }

  return backup;
}

export { createAndSendBackup };
