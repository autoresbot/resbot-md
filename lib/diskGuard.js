/**
 * diskGuard.js - Mencegah "ENOSPC: no space left on device" di panel.
 *
 * Akar masalahnya: di panel Pterodactyl, `/tmp` (os.tmpdir()) adalah tmpfs
 * KECIL (bawaan Wings ~100MB) yang baru kosong saat container dibuat ulang —
 * itulah sebabnya "restart server" selalu menyembuhkan. Padahal semua
 * konversi stiker (.brat dkk), frame thumbnail ffmpeg, dan unggahan media
 * zapo menulis berkas sementara ke sana. Beberapa stiker animasi besar atau
 * satu konversi yang gagal di tengah jalan sudah cukup untuk memenuhinya.
 *
 * Tiga lapis penanganan:
 *   1. Folder sementara dialihkan ke ./tmp/sistem (disk utama, jauh lebih
 *      lega) lewat TMPDIR — os.tmpdir() membacanya setiap kali dipanggil,
 *      jadi berlaku juga untuk ffmpeg & zapo tanpa mengubah kodenya.
 *   2. Berkas sisa di folder itu (dan sisa lama di /tmp) dibersihkan berkala.
 *   3. Bila ENOSPC tetap muncul: bersihkan darurat. Kalau masih terjadi lagi
 *      setelah dibersihkan, bot restart sendiri — paling sering sekali per
 *      JEDA_RESTART, supaya tidak restart berulang-ulang.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

const TMP_SISTEM = path.join(process.cwd(), 'tmp', 'sistem');
const PENANDA_RESTART = path.join(process.cwd(), 'database', '.restart-disk-penuh');

/** Berkas sementara dianggap sisa bila lebih tua dari ini. */
const UMUR_SISA_MS = 30 * 60 * 1000;
const INTERVAL_BERSIH_MS = 15 * 60 * 1000;
/** ENOSPC kedua dalam rentang ini setelah pembersihan darurat -> restart. */
const RENTANG_ULANG_MS = 10 * 60 * 1000;
/** Jarak minimal antar restart otomatis (juga berlaku lintas restart). */
const JEDA_RESTART_MS = 60 * 60 * 1000;

/**
 * Pola nama berkas sementara buatan bot/pustakanya di /tmp asli. Hanya ini
 * yang boleh dihapus di sana — /tmp bisa saja dipakai program lain.
 */
const POLA_SISA_TMP = [
  /^zapo-(media|enc)-/, // unggahan media zapo
  /^imgnorm_/, // lib/imageNormalizer.js
  /^[0-9a-z]{4,12}\.(webp|gif|mp4|png|jpe?g|exif|bin)$/i, // lib/exif.js & mediaProcessor
];

let tmpAsli = null;
let terakhirDarurat = 0;
let sedangRestart = false;

/** Arahkan os.tmpdir() ke ./tmp/sistem (Linux/panel saja). */
function pakaiTmpProyek() {
  // Windows memakai TEMP/TMP dan disknya tidak sesempit tmpfs panel.
  if (process.platform === 'win32') return;

  try {
    tmpAsli = os.tmpdir();
    fs.mkdirSync(TMP_SISTEM, { recursive: true });
    process.env.TMPDIR = TMP_SISTEM;
  } catch (error) {
    console.warn('[DISK] Gagal memakai folder tmp proyek:', error?.message || error);
  }
}

/** Hapus berkas di `folder` yang lebih tua dari `umurMs`. @returns jumlah byte */
function hapusBerkasLama(folder, umurMs, cocok = () => true) {
  let bebas = 0;
  let entries;
  try {
    entries = fs.readdirSync(folder, { withFileTypes: true });
  } catch {
    return 0; // folder belum ada / tidak bisa dibaca
  }

  const batas = Date.now() - umurMs;
  for (const entry of entries) {
    if (!entry.isFile() || !cocok(entry.name)) continue;
    const berkas = path.join(folder, entry.name);
    try {
      const info = fs.statSync(berkas);
      if (info.mtimeMs > batas) continue; // mungkin masih dipakai
      fs.unlinkSync(berkas);
      bebas += info.size;
    } catch {
      // sudah terhapus / sedang dipakai — lewati
    }
  }
  return bebas;
}

/** @returns jumlah byte yang dibebaskan */
function bersihkanSementara(umurMs = UMUR_SISA_MS) {
  const cocokPola = (nama) => POLA_SISA_TMP.some((pola) => pola.test(nama));
  let bebas = hapusBerkasLama(TMP_SISTEM, umurMs);

  // Sisa lama di /tmp asli (sebelum dialihkan, atau dari proses sebelumnya)
  const tmpLama = tmpAsli || (process.platform === 'win32' ? null : '/tmp');
  if (tmpLama && path.resolve(tmpLama) !== path.resolve(TMP_SISTEM)) {
    bebas += hapusBerkasLama(tmpLama, umurMs, cocokPola);
  }
  return bebas;
}

const formatMB = (byte) => `${(byte / 1024 / 1024).toFixed(1)} MB`;

function bacaRestartTerakhir() {
  try {
    return Number(fs.readFileSync(PENANDA_RESTART, 'utf8')) || 0;
  } catch {
    return 0;
  }
}

async function restartKarenaDiskPenuh() {
  if (sedangRestart) return;

  const sejak = Date.now() - bacaRestartTerakhir();
  if (sejak < JEDA_RESTART_MS) {
    console.warn(
      `[DISK] Disk masih penuh, tapi bot baru restart ${Math.round(sejak / 60000)} menit lalu — restart otomatis ditahan. Kosongkan disk panel secara manual.`,
    );
    return;
  }

  sedangRestart = true;
  try {
    fs.writeFileSync(PENANDA_RESTART, String(Date.now()));
  } catch {
    // disk benar-benar penuh; jeda tetap dijaga oleh crash-detection panel (60 detik)
  }

  console.warn('[DISK] Disk tetap penuh setelah dibersihkan — bot restart otomatis...');
  try {
    const { closeDatabase } = await import('./database.js');
    closeDatabase();
  } catch {
    // abaikan
  }
  // Keluar dengan kode error: panel (crash detection) menyalakan ulang server
  // dan membuat ulang container, sehingga /tmp kembali kosong — sama seperti
  // restart manual dari panel.
  setTimeout(() => process.exit(1), 1000);
}

function apakahDiskPenuh(error) {
  return error?.code === 'ENOSPC' || /ENOSPC|no space left on device/i.test(String(error?.message ?? error));
}

/**
 * Laporkan error dari mana pun; hanya bereaksi bila itu ENOSPC.
 * @returns {boolean} true bila error ini memang disk penuh
 */
function tanganiErrorDisk(error) {
  if (!apakahDiskPenuh(error)) return false;

  const sekarang = Date.now();
  const barusDibersihkan = sekarang - terakhirDarurat < RENTANG_ULANG_MS;

  // Pembersihan darurat: berkas umur > 2 menit dianggap sudah tidak dipakai.
  const bebas = bersihkanSementara(2 * 60 * 1000);
  console.warn(`[DISK] Disk penuh (ENOSPC) — pembersihan darurat membebaskan ${formatMB(bebas)}`);

  // Sudah dibersihkan belum lama ini tapi tetap penuh -> pembersihan saja
  // tidak cukup (mis. ruang dipegang berkas yang masih terbuka) -> restart.
  if (barusDibersihkan) {
    restartKarenaDiskPenuh();
  } else {
    terakhirDarurat = sekarang;
  }
  return true;
}

/** Dipanggil sekali saat bot mulai. */
function mulaiPenjagaDisk() {
  pakaiTmpProyek();

  // Saat baru mulai tidak ada konversi yang berjalan: semua sisa boleh dihapus.
  const bebas = bersihkanSementara(0);
  if (bebas > 0) console.log(`[DISK] Membersihkan ${formatMB(bebas)} berkas sementara lama`);

  setInterval(() => bersihkanSementara(), INTERVAL_BERSIH_MS).unref?.();
}

export { mulaiPenjagaDisk, tanganiErrorDisk, bersihkanSementara };
