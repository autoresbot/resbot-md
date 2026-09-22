/**
 * backupErrors.js - Penjelasan error untuk semua fitur backup.
 *
 * Dipakai bersama oleh:
 *   - .backup        (plugins/OWNER/backup.js)
 *   - .backuptele    (plugins/OWNER/backuptele.js)
 *   - AUTO_BACKUP    (lib/autobackup.js)
 *
 * Tujuannya: user tidak lagi menerima pesan mentah seperti
 * "Media upload failed on all hosts", tetapi tahu TAHAP mana yang gagal,
 * APA penyebabnya, dan APA yang harus dilakukan.
 */

// Nama tahapan proses backup
const STAGE = {
  CONFIG: 'Memeriksa konfigurasi',
  BACKUP: 'Membuat file backup (.zip)',
  CHECK: 'Memeriksa file backup',
  TARGET: 'Menyiapkan nomor tujuan',
  UPLOAD: 'Mengunggah & mengirim file',
};

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

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '-';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

/**
 * Error umum (jaringan & filesystem) yang dipakai baik oleh backup WhatsApp
 * maupun backup Telegram. Mengembalikan null bila tidak cocok.
 */
function jelaskanErrorUmum(err, stage, teknis) {
  const code = err?.code || '';
  const pesan = String(err?.message || '').toLowerCase();

  // ── Jaringan ──────────────────────────────────────────────────────
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return {
      stage,
      sebab: 'Server tidak bisa melakukan koneksi keluar (DNS gagal / tidak ada internet).',
      solusi: 'Cek koneksi internet server, lalu ulangi backup.',
      teknis,
    };
  }
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || pesan.includes('timed out')) {
    return {
      stage,
      sebab: 'Waktu proses habis (timeout) — file terlalu besar atau koneksi lambat.',
      solusi: 'Coba lagi saat koneksi stabil, atau kecilkan ukuran backup (kosongkan tmp/ dan logs/).',
      teknis,
    };
  }
  if (code === 'ECONNRESET' || code === 'ECONNREFUSED' || code === 'EPIPE') {
    return {
      stage,
      sebab: 'Koneksi terputus di tengah proses.',
      solusi: 'Cek kestabilan jaringan server, lalu ulangi backup.',
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

  // ── Filesystem ────────────────────────────────────────────────────
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

  return null;
}

/**
 * Terjemahkan error proses backup WhatsApp menjadi
 * { stage, sebab, solusi, teknis } berbahasa Indonesia.
 */
function jelaskanErrorWa(err, stage = STAGE.BACKUP) {
  if (err instanceof BackupError) {
    return { stage: err.stage, sebab: err.sebab, solusi: err.solusi, teknis: err.teknis };
  }

  const pesan = String(err?.message || '');
  const low = pesan.toLowerCase();
  const status = err?.output?.statusCode || err?.data || err?.status;
  const teknis = [status && `status ${status}`, err?.code, pesan].filter(Boolean).join(' — ');

  const umum = jelaskanErrorUmum(err, stage, teknis);
  if (umum) return umum;

  // ── Error khas Baileys / WhatsApp ─────────────────────────────────
  if (low.includes('media upload failed') || low.includes('all hosts')) {
    return {
      stage: STAGE.UPLOAD,
      sebab:
        'Server media WhatsApp menolak semua percobaan upload. Biasanya karena file backup terlalu besar, koneksi server tidak stabil, atau sesi WhatsApp perlu disegarkan.',
      solusi:
        'Kecilkan ukuran backup (kosongkan tmp/ dan logs/), pastikan internet server stabil, lalu ulangi .backup. Bila tetap gagal, pakai *.backuptele* atau restart bot agar sesi media diperbarui.',
      teknis,
    };
  }

  if (low.includes('connection closed') || low.includes('connection lost') || low.includes('not open')) {
    return {
      stage,
      sebab: 'Koneksi WhatsApp bot sedang terputus.',
      solusi: 'Tunggu bot terhubung kembali (cek log koneksi), lalu ulangi backup.',
      teknis,
    };
  }

  if (String(status) === '401' || low.includes('unauthorized')) {
    return {
      stage,
      sebab: 'Sesi WhatsApp ditolak (401) — sesi kedaluwarsa atau tujuan bukan JID nomor yang sah.',
      solusi: 'Scan ulang QR / pairing bot, dan pastikan nomor owner di config.js benar.',
      teknis,
    };
  }

  if (low.includes('rate-overlimit') || low.includes('rate overlimit') || low.includes('too many')) {
    return {
      stage,
      sebab: 'WhatsApp membatasi pengiriman karena terlalu sering (rate limit).',
      solusi: 'Hentikan pengiriman massal, tunggu 10–30 menit, lalu ulangi backup.',
      teknis,
    };
  }

  if (low.includes('forbidden') || String(status) === '403') {
    return {
      stage,
      sebab: 'Pengiriman ditolak WhatsApp (403) — nomor tujuan memblokir bot atau sesi dibatasi.',
      solusi: 'Pastikan nomor owner tidak memblokir bot, lalu ulangi backup.',
      teknis,
    };
  }

  return {
    stage,
    sebab: pesan || 'Terjadi kesalahan yang tidak dikenali.',
    solusi: 'Lihat detail teknis di bawah, atau cek log ERROR-COMMAND-backup.txt',
    teknis,
  };
}

/**
 * Susun pesan gagal yang enak dibaca user.
 */
function buildErrorMessage(info, judul = '❌ *Backup GAGAL*') {
  const lines = [judul, '', `📍 *Tahap :* ${info.stage}`, `⚠️ *Penyebab :* ${info.sebab}`];
  if (info.solusi) lines.push(`🛠️ *Solusi :* ${info.solusi}`);
  if (info.teknis) lines.push('', `🧾 *Detail teknis :* ${info.teknis}`);
  return lines.join('\n');
}

export { STAGE, BackupError, formatBytes, jelaskanErrorUmum, jelaskanErrorWa, buildErrorMessage };
