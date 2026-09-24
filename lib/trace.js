/**
 * trace.js - Jejak perjalanan SATU pesan, dari masuk sampai selesai/berhenti.
 *
 * Latar belakang:
 * Kalau bot "tidak merespons", selama ini tidak ada cara membedakan tiga hal
 * yang gejalanya sama persis di mata user:
 *   1. pesannya memang TIDAK PERNAH sampai ke bot (masalah koneksi/dekripsi
 *      WhatsApp, bukan kode),
 *   2. pesannya sampai tapi DIHENTIKAN sebuah fitur (belum .acc, mute, rate
 *      limit, ban, silent, antilink, dll),
 *   3. pesannya sampai dan command-nya dijalankan, tapi pengirimannya gagal.
 *
 * Modul ini mencetak satu baris untuk setiap tahap, jadi ketiganya langsung
 * bisa dibedakan dari console. Salinannya disimpan di logs/jejak-chat.log.
 *
 * Secara default jejak ini HANYA menyala di mode development, supaya console
 * mode production tetap rapi seperti semula. Bisa dipaksa lewat config.js:
 * `TRACE_CHAT = true` (selalu nyala) atau `false` (selalu mati).
 */

import chalk from 'chalk';
import config from '../config.js';
import { logLine } from './errorLogger.js';

const FILE_LOG = 'jejak-chat.log';

/**
 * Jejak menyala kalau:
 *  - TRACE_CHAT = true  -> dipaksa nyala di mode apa pun, atau
 *  - TRACE_CHAT = null  -> ikut MODE (nyala hanya di development)
 * dan mati kalau TRACE_CHAT = false.
 */
function jejakAktif() {
  if (config.trace_chat === true) return true;
  if (config.trace_chat === false) return false;
  return config.mode === 'development';
}

function potong(teks, maks = 40) {
  const satuBaris = String(teks ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!satuBaris) return '';
  return satuBaris.length > maks ? `${satuBaris.slice(0, maks)}...` : satuBaris;
}

/** Nama chat dipendekkan: ID grup panjangnya 20+ digit dan bikin baris log melar. */
function pendekkanJid(jid) {
  if (!jid) return '-';
  const [nomor, domain] = String(jid).split('@');
  if (!domain) return jid;
  const ringkas = nomor.length > 12 ? `${nomor.slice(0, 6)}..${nomor.slice(-4)}` : nomor;
  return `${ringkas}@${domain}`;
}

/**
 * Baca teks pesan LANGSUNG dari objek mentah WhatsApp.
 *
 * Dipakai di titik paling awal (sebelum serializeMessage), supaya pesan yang
 * gagal diparsing pun tetap terlihat isinya di log.
 */
function teksMentah(message) {
  const isi = message?.message || {};
  const dalam = isi.ephemeralMessage?.message || isi.viewOnceMessage?.message || isi;
  return (
    dalam.conversation ||
    dalam.extendedTextMessage?.text ||
    dalam.imageMessage?.caption ||
    dalam.videoMessage?.caption ||
    dalam.documentMessage?.caption ||
    (dalam.stickerMessage ? '[stiker]' : '') ||
    (dalam.audioMessage ? '[audio]' : '') ||
    (dalam.imageMessage ? '[gambar]' : '') ||
    (dalam.videoMessage ? '[video]' : '') ||
    ''
  );
}

/** Ringkasan identitas pesan yang sama bentuknya di semua baris log. */
function ringkas(info = {}) {
  const nama = info.pushName || info.sender || '-';
  const chat = pendekkanJid(info.remoteJid);
  const teks = potong(info.fullText ?? info.teks ?? '');
  const id = String(info.id || '-').slice(0, 8);
  return `${nama} @ ${chat}${teks ? ` | "${teks}"` : ''} | id:${id}`;
}

function tulis(label, warna, isi) {
  if (!jejakAktif()) return;
  console.log(warna(`${label} ${isi}`));
  try {
    logLine(FILE_LOG, `${label} ${isi}`);
  } catch {
    // logging tidak boleh ikut menjatuhkan pemrosesan pesan
  }
}

/** Pesan baru sampai ke bot. Selalu jadi baris PERTAMA sebuah jejak. */
function chatMasuk(info) {
  tulis('[CHAT MASUK]   ', chalk.cyan, ringkas(info));
}

/**
 * Pesan dihentikan di suatu tahap - ini baris yang menjawab
 * "bot tidak merespons gara-gara apa".
 */
function chatBerhenti(tahap, alasan, info) {
  tulis(
    '[CHAT BERHENTI]',
    chalk.yellow,
    `${tahap}${alasan ? ` - ${alasan}` : ''} | ${ringkas(info)}`,
  );
}

/** Pesan lolos semua penyaring dan command-nya dijalankan. */
function chatSelesai(tahap, info) {
  tulis('[CHAT SELESAI] ', chalk.green, `${tahap} | ${ringkas(info)}`);
}

/** Tahap antara (lolos handler, mulai plugin, dst). */
function chatTahap(tahap, info) {
  tulis('[CHAT LANJUT]  ', chalk.gray, `${tahap} | ${ringkas(info)}`);
}

/**
 * Pesan sampai ke bot tapi gagal di tengah jalan karena error.
 *
 * SELALU dicetak, juga di mode production: ini error sungguhan, bukan jejak
 * biasa, dan dulu pun sudah muncul di console.
 */
function chatError(tahap, error, info) {
  const isi = `[CHAT ERROR]    ${tahap} - ${error?.message || error} | ${ringkas(info)}`;
  console.log(chalk.redBright(isi));
  try {
    logLine(FILE_LOG, isi);
  } catch {
    // logging tidak boleh ikut menjatuhkan pemrosesan pesan
  }
}

export {
  jejakAktif,
  chatMasuk,
  chatBerhenti,
  chatSelesai,
  chatTahap,
  chatError,
  teksMentah,
  pendekkanJid,
  potong,
};
