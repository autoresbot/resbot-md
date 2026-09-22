/**
 * telegramBackup.js - Sumber tunggal logika backup ke Telegram.
 *
 * Dipakai bersama oleh:
 *   - Plugin .backuptele (plugins/OWNER/backuptele.js)
 *   - Fitur AUTO_BACKUP (lib/autobackup.js) bila TELEGRAM diisi di config.js
 *
 * Konfigurasi dibaca dari config.js:
 *   TELEGRAM: { token: '...', chat_id: '...' }
 *
 * Semua kegagalan dilempar sebagai BackupError sehingga pesannya jelas:
 * tahap mana yang gagal, apa penyebabnya, dan apa solusinya.
 */

import FormData from 'form-data';
import fs from 'fs';
import axios from 'axios';
import moment from 'moment-timezone';
import config from '../config.js';
import { createBackup } from './utils.js';
import { BackupError, STAGE, formatBytes, jelaskanErrorUmum } from './backupErrors.js';

const BACKUP_FILENAME = 'autoresbot-backup.zip';

// Batas upload dokumen lewat Bot API Telegram = 50 MB
const TELEGRAM_MAX_UPLOAD = 50 * 1024 * 1024;

/**
 * Ambil token & chat id dari config.js (atau dari argumen override).
 */
function getTelegramConfig(override = {}) {
  const token = String(override.token || config.TELEGRAM?.token || '').trim();
  const chatId = String(override.chatId || config.TELEGRAM?.chat_id || '').trim();
  return { token, chatId };
}

/**
 * Apakah backup Telegram sudah dikonfigurasi?
 */
function isTelegramConfigured(override = {}) {
  const { token, chatId } = getTelegramConfig(override);
  return Boolean(token && chatId);
}

/**
 * Pesan panduan bila token / chat id belum diisi.
 */
function panduanSetup() {
  return `⚠️ *Backup Telegram belum dikonfigurasi*

Token bot / chat id belum diisi. Ikuti langkah berikut:

*A. Membuat Bot & Token (BotFather)*
1. Buka Telegram, cari akun *@BotFather*
2. Ketik /newbot lalu ikuti instruksinya (beri nama & username bot)
3. BotFather akan memberi *token*, contoh:
   \`123456789:AAE-xxxxxxxxxxxxxxxxxxxxxxxxxx\`

*B. Mendapatkan Chat ID*
1. Kirim satu pesan apa saja ke bot yang baru kamu buat
2. Buka di browser (ganti <TOKEN> dengan token kamu):
   https://api.telegram.org/bot<TOKEN>/getUpdates
3. Cari bagian \`"chat":{"id":...}\` — angka itulah *chat id* kamu
   (untuk grup, tambahkan botnya ke grup lalu kirim pesan; id grup diawali tanda minus)
   Alternatif: chat ke *@userinfobot* untuk melihat id akunmu.

*C. Menyimpan Konfigurasi*
Isi di *config.js*:
\`\`\`
const TELEGRAM_BOT_TOKEN = 'token_kamu';
const TELEGRAM_CHAT_ID   = 'chat_id_kamu';
\`\`\`

Setelah diisi, restart bot lalu jalankan kembali perintah *.backuptele*`;
}

/**
 * Validasi bentuk token & chat id SEBELUM menghubungi Telegram,
 * supaya error-nya jelas (bukan 404/400 mentah dari API).
 */
function validateTelegramConfig(token, chatId) {
  if (!/^\d+:[\w-]{30,}$/.test(token)) {
    throw new BackupError(
      STAGE.CONFIG,
      'Format token bot Telegram tidak valid.',
      'Token harus berbentuk `angka:huruf-acak`, contoh 123456789:AAE-xxxxxxxxxxxxxxxx. Salin ulang dari @BotFather ke TELEGRAM_BOT_TOKEN di config.js.',
      `token diawali "${token.slice(0, 12)}..." (${token.length} karakter)`,
    );
  }

  if (!/^-?\d+$/.test(chatId)) {
    throw new BackupError(
      STAGE.CONFIG,
      `TELEGRAM_CHAT_ID "${chatId}" bukan angka.`,
      'Chat ID harus berupa angka (grup diawali tanda minus). Cek lewat @userinfobot atau /getUpdates.',
    );
  }
}

/**
 * Pastikan token benar-benar hidup & chat id bisa dijangkau bot,
 * sebelum membuang waktu membuat dan mengupload file zip.
 */
async function verifyTelegramAccess(token, chatId) {
  const { data } = await axios.get(`https://api.telegram.org/bot${token}/getChat`, {
    params: { chat_id: chatId },
    timeout: 20000,
  });

  if (!data?.ok) {
    throw new BackupError(
      STAGE.CONFIG,
      data?.description || 'Telegram menolak permintaan tanpa keterangan.',
      'Periksa kembali token dan chat id di config.js.',
      JSON.stringify(data).slice(0, 300),
    );
  }

  return data.result;
}

/**
 * Terjemahkan error Telegram / jaringan / filesystem menjadi
 * { stage, sebab, solusi, teknis } berbahasa Indonesia.
 */
function jelaskanErrorTelegram(err, stage) {
  if (err instanceof BackupError) {
    return { stage: err.stage, sebab: err.sebab, solusi: err.solusi, teknis: err.teknis };
  }

  const status = err?.response?.status;
  const description = err?.response?.data?.description || '';
  const desc = description.toLowerCase();
  const teknis = [status && `HTTP ${status}`, err?.code, description || err?.message]
    .filter(Boolean)
    .join(' - ');

  // ── Error dari API Telegram ───────────────────────────────────────
  if (status === 401 || desc.includes('unauthorized')) {
    return {
      stage,
      sebab: 'Token bot Telegram ditolak (tidak valid / sudah dicabut).',
      solusi:
        'Buka @BotFather -> /mybots -> pilih bot -> API Token, lalu salin ulang token ke TELEGRAM_BOT_TOKEN di config.js.',
      teknis,
    };
  }

  if (desc.includes('chat not found')) {
    return {
      stage,
      sebab: 'Chat ID tidak ditemukan oleh bot.',
      solusi:
        'Pastikan TELEGRAM_CHAT_ID benar, dan kamu sudah pernah menekan /start di bot tersebut. Untuk grup, bot harus sudah ditambahkan ke grup dan ID grup diawali tanda minus (-).',
      teknis,
    };
  }

  if (desc.includes('bot was blocked') || desc.includes("bot can't initiate")) {
    return {
      stage,
      sebab: 'Bot diblokir atau belum pernah kamu ajak chat.',
      solusi: 'Buka chat bot di Telegram, tekan Unblock / Start, lalu ulangi .backuptele',
      teknis,
    };
  }

  if (status === 403 || desc.includes('not enough rights') || desc.includes('forbidden')) {
    return {
      stage,
      sebab: 'Bot tidak punya izin mengirim file ke chat/grup tujuan.',
      solusi: 'Jadikan bot anggota chat tujuan (untuk channel, jadikan admin).',
      teknis,
    };
  }

  if (status === 413 || desc.includes('too large') || desc.includes('entity too large')) {
    return {
      stage,
      sebab: `File backup melebihi batas upload Telegram (${formatBytes(TELEGRAM_MAX_UPLOAD)}).`,
      solusi:
        'Kecilkan ukuran project: kosongkan folder tmp/ dan logs/, hapus file media besar yang tidak perlu.',
      teknis,
    };
  }

  if (status === 429 || desc.includes('too many requests')) {
    const retry = err?.response?.data?.parameters?.retry_after;
    return {
      stage,
      sebab: 'Terkena limit Telegram (terlalu sering mengirim).',
      solusi: retry
        ? `Tunggu ${retry} detik lalu coba lagi.`
        : 'Tunggu beberapa menit lalu coba lagi.',
      teknis,
    };
  }

  if (status === 404) {
    return {
      stage,
      sebab: 'Endpoint Telegram tidak ditemukan - biasanya karena format token salah.',
      solusi:
        'Token harus berbentuk `angka:huruf-acak`, contoh 123456789:AAE-xxxxxxxx. Salin ulang dari @BotFather.',
      teknis,
    };
  }

  if (status >= 500) {
    return {
      stage,
      sebab: 'Server Telegram sedang bermasalah.',
      solusi: 'Bukan kesalahan konfigurasi. Tunggu beberapa menit lalu ulangi .backuptele',
      teknis,
    };
  }

  // ── Jaringan & filesystem (dipakai bersama backup WhatsApp) ───────
  const umum = jelaskanErrorUmum(err, stage, teknis);
  if (umum) {
    if (err?.code === 'ENOTFOUND' || err?.code === 'EAI_AGAIN') {
      umum.sebab = 'Server tidak bisa menghubungi api.telegram.org (DNS gagal / tidak ada internet).';
      umum.solusi = 'Cek koneksi internet server. Jika Telegram diblokir provider, gunakan VPN/proxy.';
    }
    return umum;
  }

  return {
    stage,
    sebab: err?.message || 'Terjadi kesalahan yang tidak dikenali.',
    solusi: 'Lihat detail teknis di bawah, atau cek log ERROR-COMMAND-backuptele.txt',
    teknis,
  };
}

/**
 * Susun caption dokumen backup.
 */
function buildCaption(backup, type = 'Manual') {
  const tanggal = moment.tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm:ss');
  const lines = ['🗄️ *Backup Data (Telegram)*', `📅 Tanggal : ${tanggal}`];
  if (backup?.size) lines.push(`📦 Ukuran : ${backup.size}`);
  lines.push(`🏷️ Jenis : ${type}`);
  return lines.join('\n');
}

/**
 * Validasi file backup sebelum diupload (ada, tidak kosong, tidak melebihi limit).
 */
function validateBackupFile(filePath) {
  let stats;
  try {
    stats = fs.statSync(filePath);
  } catch (err) {
    throw new BackupError(
      STAGE.CHECK,
      'File backup tidak berhasil dibuat.',
      'Pastikan folder project bisa ditulis dan ruang disk masih cukup.',
      `${err.code || 'ERR'} - ${filePath}`,
    );
  }

  if (stats.size === 0) {
    throw new BackupError(
      STAGE.CHECK,
      'File backup kosong (0 byte).',
      'Proses zip gagal. Jalankan ulang .backuptele, jika tetap kosong periksa izin folder project.',
      filePath,
    );
  }

  if (stats.size > TELEGRAM_MAX_UPLOAD) {
    throw new BackupError(
      STAGE.CHECK,
      `Ukuran backup ${formatBytes(stats.size)} melebihi batas upload Telegram (${formatBytes(
        TELEGRAM_MAX_UPLOAD,
      )}).`,
      'Kosongkan folder tmp/ dan logs/, hapus file media besar yang tidak perlu, lalu ulangi.',
      `size=${stats.size} byte`,
    );
  }

  return stats;
}

/**
 * Kirim file backup ke Telegram via API sendDocument (streaming, hemat memori).
 */
async function sendToTelegram(token, chatId, filePath, caption) {
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', caption);
  form.append('parse_mode', 'Markdown');
  form.append('document', fs.createReadStream(filePath), { filename: BACKUP_FILENAME });

  const { data } = await axios.post(`https://api.telegram.org/bot${token}/sendDocument`, form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: 300000,
  });

  if (!data?.ok) {
    throw new BackupError(
      STAGE.UPLOAD,
      data?.description || 'Telegram menolak permintaan tanpa keterangan.',
      'Periksa kembali token dan chat id di config.js.',
      JSON.stringify(data).slice(0, 300),
    );
  }

  return data;
}

/**
 * Buat backup lalu kirim ke Telegram.
 *
 * Urutan sengaja: konfigurasi diperiksa & diuji ke Telegram DULU, baru zip dibuat.
 * Jadi kalau token/chat id salah, user langsung tahu tanpa menunggu proses zip.
 *
 * @param {object} [options]
 * @param {string} [options.type='Manual'] - jenis backup untuk caption
 * @param {string} [options.token] - override token (opsional)
 * @param {string} [options.chatId] - override chat id (opsional)
 * @returns {Promise<{backup:object, chat:object|null}>}
 * @throws {BackupError} dengan stage/sebab/solusi yang sudah jelas
 */
async function createAndSendTelegramBackup(options = {}) {
  const { type = 'Manual' } = options;
  const { token, chatId } = getTelegramConfig(options);

  // 1) Konfigurasi
  if (!token || !chatId) {
    throw new BackupError(
      STAGE.CONFIG,
      'Token bot / chat id Telegram belum diisi.',
      'Isi TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID di config.js. Ketik .backuptele untuk melihat panduan lengkap.',
    );
  }
  validateTelegramConfig(token, chatId);

  // 2) Uji akses ke Telegram lebih dulu (token hidup? chat bisa dijangkau?)
  const chat = await verifyTelegramAccess(token, chatId);

  // 3) Buat file backup
  const backup = await createBackup();

  // 4) Pastikan file layak dikirim
  validateBackupFile(backup.path);

  // 5) Upload
  await sendToTelegram(token, chatId, backup.path, buildCaption(backup, type));

  return { backup, chat: chat || null };
}

export {
  createAndSendTelegramBackup,
  isTelegramConfigured,
  getTelegramConfig,
  jelaskanErrorTelegram,
  panduanSetup,
  TELEGRAM_MAX_UPLOAD,
};
