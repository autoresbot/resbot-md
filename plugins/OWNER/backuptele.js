// ════════════════════════════════════════════════════════════════════
// 🔧 KONFIGURASI TELEGRAM  (isi di sini, atau lewat config.js — lihat bawah)
// ════════════════════════════════════════════════════════════════════
//
// Cara mengisi:
//   1. TELEGRAM_BOT_TOKEN : token bot dari @BotFather (langkah di bawah).
//   2. TELEGRAM_CHAT_ID    : ID tujuan (chat pribadi / grup / channel).
//
// Contoh:
//   const TELEGRAM_BOT_TOKEN = '123456789:AAE-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
//   const TELEGRAM_CHAT_ID   = '123456789';
//
const TELEGRAM_BOT_TOKEN = '8822823396:AAGwsrmOWZp9npz5tVkf591Y2JxrwioboSc';
const TELEGRAM_CHAT_ID = '6398972009';
// ════════════════════════════════════════════════════════════════════

import FormData from 'form-data';
import fs from 'fs';
import axios from 'axios';
import moment from 'moment-timezone';
import config from '../../config.js';
import { createBackup } from '../../lib/utils.js';
import { logCustom } from '../../lib/logger.js';

const BACKUP_FILENAME = 'autoresbot-backup.zip';

// Batas upload dokumen lewat Bot API Telegram = 50 MB
const TELEGRAM_MAX_UPLOAD = 50 * 1024 * 1024;

// Nama tahapan, dipakai supaya pesan error menyebut proses mana yang gagal
const STAGE = {
  CONFIG: 'Memeriksa konfigurasi',
  BACKUP: 'Membuat file backup (.zip)',
  CHECK: 'Memeriksa file backup',
  UPLOAD: 'Mengirim file ke Telegram',
};

/**
 * Ambil token & chat id. Prioritas: konstanta di atas file,
 * lalu fallback ke config.js (config.TELEGRAM = { token, chat_id }).
 */
function getTelegramConfig() {
  const token = (TELEGRAM_BOT_TOKEN || config.TELEGRAM?.token || '').trim();
  const chatId = String(TELEGRAM_CHAT_ID || config.TELEGRAM?.chat_id || '').trim();
  return { token, chatId };
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
Isi di bagian atas file \`plugins/OWNER/backuptele.js\`:
\`\`\`
const TELEGRAM_BOT_TOKEN = 'token_kamu';
const TELEGRAM_CHAT_ID   = 'chat_id_kamu';
\`\`\`
Atau lewat *config.js*:
\`\`\`
TELEGRAM: { token: 'token_kamu', chat_id: 'chat_id_kamu' }
\`\`\`

Setelah diisi, jalankan kembali perintah *.backuptele*`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '-';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

/**
 * Error yang sudah membawa penjelasan & solusi siap dibaca user dari WhatsApp.
 */
class BackupError extends Error {
  constructor(stage, sebab, solusi, teknis = null) {
    super(sebab);
    this.name = 'BackupError';
    this.stage = stage;
    this.sebab = sebab;
    this.solusi = solusi;
    this.teknis = teknis;
  }
}

/**
 * Terjemahkan error Telegram / jaringan / filesystem menjadi
 * { stage, sebab, solusi, teknis } berbahasa Indonesia.
 */
function jelaskanError(err, stage) {
  if (err instanceof BackupError) {
    return { stage: err.stage, sebab: err.sebab, solusi: err.solusi, teknis: err.teknis };
  }

  const status = err?.response?.status;
  const description = err?.response?.data?.description || '';
  const desc = description.toLowerCase();
  const code = err?.code || '';
  const teknis = [status && `HTTP ${status}`, code, description || err?.message]
    .filter(Boolean)
    .join(' — ');

  // ── Error dari API Telegram ───────────────────────────────────────
  if (status === 401 || desc.includes('unauthorized')) {
    return {
      stage,
      sebab: 'Token bot Telegram ditolak (tidak valid / sudah dicabut).',
      solusi:
        'Buka @BotFather → /mybots → pilih bot → API Token, lalu salin ulang token ke TELEGRAM_BOT_TOKEN.',
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
      sebab: 'Endpoint Telegram tidak ditemukan — biasanya karena format token salah.',
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

  // ── Error jaringan ────────────────────────────────────────────────
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return {
      stage,
      sebab: 'Server tidak bisa menghubungi api.telegram.org (DNS gagal / tidak ada internet).',
      solusi: 'Cek koneksi internet server. Jika Telegram diblokir provider, gunakan VPN/proxy.',
      teknis,
    };
  }

  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || desc.includes('timeout')) {
    return {
      stage,
      sebab: 'Waktu upload habis (timeout) — file terlalu besar atau koneksi lambat.',
      solusi:
        'Coba lagi saat koneksi stabil, atau kecilkan ukuran backup (kosongkan tmp/ dan logs/).',
      teknis,
    };
  }

  if (code === 'ECONNRESET' || code === 'ECONNREFUSED' || code === 'EPIPE') {
    return {
      stage,
      sebab: 'Koneksi ke Telegram terputus di tengah proses.',
      solusi: 'Cek kestabilan jaringan server, lalu ulangi .backuptele',
      teknis,
    };
  }

  if (code === 'CERT_HAS_EXPIRED' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
    return {
      stage,
      sebab: 'Verifikasi sertifikat SSL gagal.',
      solusi: 'Perbaiki jam/tanggal server, lalu update paket ca-certificates.',
      teknis,
    };
  }

  // ── Error filesystem ──────────────────────────────────────────────
  if (code === 'ENOSPC') {
    return {
      stage,
      sebab: 'Ruang disk server penuh, file backup tidak bisa dibuat.',
      solusi: 'Kosongkan disk (hapus isi tmp/ dan logs/), lalu ulangi.',
      teknis,
    };
  }

  if (code === 'EACCES' || code === 'EPERM') {
    return {
      stage,
      sebab: 'Tidak punya izin menulis/membaca file backup.',
      solusi: 'Periksa izin folder project, pastikan bot bisa menulis di direktori project.',
      teknis,
    };
  }

  if (code === 'ENOENT') {
    return {
      stage,
      sebab: 'File backup tidak ditemukan saat akan dikirim.',
      solusi: 'Pastikan proses zip selesai dan folder project bisa ditulis.',
      teknis,
    };
  }

  if (code === 'EMFILE' || code === 'ENFILE') {
    return {
      stage,
      sebab: 'Terlalu banyak file terbuka saat proses zip.',
      solusi: 'Restart bot, atau naikkan limit file server (ulimit -n).',
      teknis,
    };
  }

  // ── Tidak dikenali ────────────────────────────────────────────────
  return {
    stage,
    sebab: err?.message || 'Terjadi kesalahan yang tidak dikenali.',
    solusi: 'Lihat detail teknis di bawah, atau cek log ERROR-COMMAND-backuptele.txt',
    teknis,
  };
}

/**
 * Susun pesan gagal yang enak dibaca user.
 */
function buildErrorMessage({ stage, sebab, solusi, teknis }) {
  const lines = [
    '❌ *Backup ke Telegram GAGAL*',
    '',
    `📍 *Tahap :* ${stage}`,
    `⚠️ *Penyebab :* ${sebab}`,
  ];
  if (solusi) lines.push(`🛠️ *Solusi :* ${solusi}`);
  if (teknis) lines.push('', `🧾 *Detail teknis :* ${teknis}`);
  return lines.join('\n');
}

/**
 * Susun caption dokumen backup.
 */
function buildCaption(backup) {
  const tanggal = moment.tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm:ss');
  const lines = ['🗄️ *Backup Data (Telegram)*', `📅 Tanggal : ${tanggal}`];
  if (backup?.size) lines.push(`📦 Ukuran : ${backup.size}`);
  lines.push('🏷️ Jenis : Manual');
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
      `${err.code || 'ERR'} — ${filePath}`,
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

  const { data } = await axios.post(
    `https://api.telegram.org/bot${token}/sendDocument`,
    form,
    {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 300000,
    },
  );

  if (!data?.ok) {
    throw new BackupError(
      STAGE.UPLOAD,
      data?.description || 'Telegram menolak permintaan tanpa keterangan.',
      'Periksa kembali token dan chat id di konfigurasi.',
      JSON.stringify(data).slice(0, 300),
    );
  }
  return data;
}

async function handle(sock, messageInfo) {
  const { remoteJid, message } = messageInfo;

  // Dipakai supaya pesan error tahu proses mana yang sedang berjalan
  let stage = STAGE.CONFIG;

  try {
    const { token, chatId } = getTelegramConfig();

    // Belum dikonfigurasi -> kirim panduan, jangan lanjut
    if (!token || !chatId) {
      return await sock.sendMessage(remoteJid, { text: panduanSetup() }, { quoted: message });
    }

    // Format salah -> jelaskan sekarang, jangan tunggu 404/400 dari Telegram
    if (!/^\d+:[\w-]{30,}$/.test(token)) {
      throw new BackupError(
        STAGE.CONFIG,
        'Format TELEGRAM_BOT_TOKEN tidak valid.',
        'Token harus berbentuk `angka:huruf-acak`, contoh 123456789:AAE-xxxxxxxxxxxxxxxx. Salin ulang dari @BotFather.',
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

    await sock.sendMessage(remoteJid, {
      react: { text: '⏰', key: message.key },
    });

    // Buat file backup (path, size, time)
    stage = STAGE.BACKUP;
    const backup = await createBackup();

    // Pastikan file layak dikirim sebelum upload
    stage = STAGE.CHECK;
    validateBackupFile(backup.path);

    // Kirim ke Telegram
    stage = STAGE.UPLOAD;
    await sendToTelegram(token, chatId, backup.path, buildCaption(backup));

    return await sock.sendMessage(
      remoteJid,
      {
        text: `✅ _Berhasil, data backup telah terkirim ke Telegram_

Size : ${backup.size}
Time : ${backup.time}
`,
      },
      { quoted: message },
    );
  } catch (err) {
    const info = jelaskanError(err, stage);

    console.error(`[BACKUPTELE] Gagal pada tahap "${info.stage}":`, err);
    logCustom(
      'error',
      `[${info.stage}] ${info.sebab} | ${info.teknis || '-'}\n${err?.stack || ''}`,
      'ERROR-COMMAND-backuptele.txt',
    );

    return await sock.sendMessage(
      remoteJid,
      { text: buildErrorMessage(info) },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['backuptele'],
  OnlyPremium: false,
  OnlyOwner: true,
};
