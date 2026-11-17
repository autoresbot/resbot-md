/**
 * zapoUpdater.js - Menjaga library zapo-js (+ @zapo-js/store-sqlite) selalu
 * terbaru, dengan rollback otomatis bila update membuat bot gagal terhubung.
 *
 * zapo-js adalah library koneksi WhatsApp yang rilis sangat sering (mengejar
 * perubahan protokol WA). Versi lama bisa tiba-tiba berhenti konek, jadi bot
 * perlu bisa ikut versi terbaru. Tapi upgrade buta juga berisiko: satu rilis
 * yang breaking bisa mematikan bot. Modul ini menengahi keduanya:
 *
 *   1. Saat start, cek versi terbaru di npm. Kalau ada yang lebih baru dan
 *      auto-update aktif -> catat versi lama ke penanda, lalu `npm install`.
 *   2. Setelah koneksi WhatsApp pertama berhasil -> penanda dihapus (update
 *      dianggap "terverifikasi").
 *   3. Kalau boot berikutnya penanda masih ada (artinya update kemarin tak
 *      pernah berhasil konek) -> otomatis ROLLBACK ke versi lama.
 *
 * Catatan: proses auto-update dikendalikan dari index.js (AUTO_UPDATE_ZAPO),
 * BUKAN dari config.js.
 */
import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';

const PENANDA = path.join(process.cwd(), 'database', '.zapo-update.json');

/** Paket yang dijaga tetap terbaru. */
const PAKET = ['zapo-js', '@zapo-js/store-sqlite'];

/**
 * Versi yang sedang terpasang. Dibaca LANGSUNG dari berkas
 * node_modules/<nama>/package.json — bukan `require(...)` — karena sebagian
 * paket (mis. @zapo-js/store-sqlite) membatasi `exports` sehingga
 * `require('<nama>/package.json')` dilarang.
 */
function versiTerpasang(nama) {
  try {
    const pkgPath = path.join(process.cwd(), 'node_modules', ...nama.split('/'), 'package.json');
    const data = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return data.version || null;
  } catch {
    return null;
  }
}

/** Versi terbaru di registry npm (sinkron, dijaga timeout). */
function versiNpm(nama) {
  try {
    const out = execSync(`npm view ${nama} version`, {
      encoding: 'utf8',
      timeout: 60_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return String(out).trim() || null;
  } catch {
    return null;
  }
}

/** true bila versi `a` lebih baru dari `b` (bandingkan mayor.minor.patch). */
function lebihBaru(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

function bacaPenanda() {
  try {
    return JSON.parse(fs.readFileSync(PENANDA, 'utf8'));
  } catch {
    return null;
  }
}

function tulisPenanda(obj) {
  try {
    fs.writeFileSync(PENANDA, JSON.stringify(obj, null, 2));
  } catch (error) {
    console.warn('[ZAPO] Gagal menulis penanda update:', error?.message || error);
  }
}

function hapusPenanda() {
  try {
    fs.unlinkSync(PENANDA);
  } catch {
    // tidak ada / sudah terhapus — abaikan
  }
}

/** Jalankan `npm install <specs...>`. @returns {Promise<boolean>} sukses? */
function npmInstall(specs) {
  return new Promise((resolve) => {
    try {
      const proc = spawn('npm', ['install', ...specs], { stdio: 'inherit', shell: true });
      proc.on('close', (code) => resolve(code === 0));
      proc.on('error', () => resolve(false));
    } catch {
      resolve(false);
    }
  });
}

/**
 * Dipanggil di index.js SEBELUM koneksi dibuka. Menjalankan rollback (bila
 * perlu) lalu update (bila ada versi lebih baru & auto-update aktif).
 */
async function sinkronkanZapo({ autoUpdate = true } = {}) {
  // ── Tahap 1: rollback kalau update sebelumnya tak terverifikasi ──────────
  const penanda = bacaPenanda();
  if (penanda && penanda.verified === false && penanda.previous) {
    console.warn(
      '[ZAPO] Update sebelumnya tidak terverifikasi (bot tidak berhasil konek). Rollback ke versi lama...',
    );
    const specs = PAKET.map((n) => (penanda.previous[n] ? `${n}@${penanda.previous[n]}` : null)).filter(
      Boolean,
    );
    if (specs.length) {
      const ok = await npmInstall(specs);
      console.warn(
        ok
          ? `[ZAPO] Rollback berhasil: ${specs.join(', ')}`
          : '[ZAPO] Rollback gagal dijalankan (cek jaringan/npm).',
      );
    }
    hapusPenanda();
    return; // boot ini pakai versi lama dulu — stabilkan sebelum coba update lagi
  }

  if (!autoUpdate) return;

  // ── Tahap 2: cek & pasang versi terbaru ──────────────────────────────────
  const perluUpdate = [];
  const previous = {};
  for (const nama of PAKET) {
    const terpasang = versiTerpasang(nama);
    previous[nama] = terpasang;
    const terbaru = versiNpm(nama);
    if (terpasang && terbaru && lebihBaru(terbaru, terpasang)) {
      perluUpdate.push(nama);
      console.log(`[ZAPO] ${nama}: ${terpasang} -> ${terbaru} (update tersedia)`);
    }
  }

  if (!perluUpdate.length) {
    console.log('[ZAPO] zapo-js sudah versi terbaru.');
    return;
  }

  // Penanda ditulis SEBELUM install: kalau update bikin bot gagal konek, boot
  // berikutnya tahu harus rollback ke `previous`.
  tulisPenanda({ previous, at: Date.now(), verified: false });

  const ok = await npmInstall(perluUpdate.map((n) => `${n}@latest`));
  if (ok) {
    console.log('[ZAPO] Update selesai — akan diverifikasi setelah koneksi berhasil.');
  } else {
    console.warn('[ZAPO] Update gagal dijalankan (npm). Tetap pakai versi lama.');
    hapusPenanda();
  }
}

/**
 * Dipanggil di index.js SETELAH start_app(). Memantau koneksi: begitu salah
 * satu sesi berhasil terhubung, penanda dihapus (update terverifikasi). Kalau
 * sampai batas waktu belum konek, penanda dibiarkan agar boot berikutnya
 * melakukan rollback.
 */
function pantauVerifikasiZapo({ timeoutMs = 15 * 60 * 1000 } = {}) {
  const penanda = bacaPenanda();
  if (!penanda || penanda.verified !== false) return; // tidak ada yang perlu diverifikasi

  const mulai = Date.now();
  const timer = setInterval(() => {
    const terhubung = Object.values(global.statusConnected || {}).some(Boolean);
    if (terhubung) {
      clearInterval(timer);
      hapusPenanda();
      console.log('[ZAPO] ✅ Update zapo-js terverifikasi (koneksi berhasil).');
    } else if (Date.now() - mulai > timeoutMs) {
      clearInterval(timer);
      console.warn(
        '[ZAPO] ⚠️ Koneksi belum berhasil sampai batas waktu — zapo-js akan di-rollback saat restart berikutnya.',
      );
    }
  }, 5_000);
  timer.unref?.();
}

export { sinkronkanZapo, pantauVerifikasiZapo };
