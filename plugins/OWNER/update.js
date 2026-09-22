import fs from 'fs';
import path from 'path';
import axios from 'axios';
import extract from 'extract-zip';
import fse from 'fs-extra';

const serverUrl = 'https://github.com/autoresbot/resbot-md/archive/refs/heads/master.zip';

const WHITELIST = new Set([
  'config.js',
  'strings.js',
  'update.js',
  'database',
  'node_modules',
  '.git',
  'session',
  'version.txt',
  'update_temp',
  'update.zip',
  'update.lock', // ✅ penting
]);

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Download dengan retry ───────────────────────────────────────────
//
// File update diunduh dari GitHub, bukan dari server API autoresbot. URL
// archive dialihkan ke codeload.github.com yang MEMBUAT zip saat diminta, dan
// sesekali gateway-nya timeout (HTTP 504) atau sibuk (502/503/429). Kondisi itu
// sementara, jadi cukup dicoba ulang — sebelumnya satu kegagalan langsung
// berakhir "❌ UPDATE FAILED Request failed with status code 504".
const MAX_PERCOBAAN = 3;
const JEDA_PERCOBAAN_MS = [5000, 10000]; // jeda sebelum percobaan ke-2 dan ke-3
const BATAS_MACET_MS = 60000; // download dibatalkan bila tidak ada data 60 detik

/** Error yang layak dicoba ulang: jaringan putus/timeout, 5xx, dan 429. */
function bisaDicobaUlang(error) {
  const status = error?.response?.status;
  if (status) return status >= 500 || status === 429;
  return true; // tidak ada respons -> masalah jaringan/timeout/stream putus
}

/** Pesan yang dimengerti owner, bukan hanya "Request failed with status code 504". */
function jelaskanError(error) {
  const status = error?.response?.status;
  if (status === 504) return 'Server GitHub timeout (HTTP 504) saat menyiapkan file update';
  if (status === 502 || status === 503) return `Server GitHub sedang sibuk (HTTP ${status})`;
  if (status === 429) return 'Terlalu banyak permintaan ke GitHub (HTTP 429)';
  if (status === 404) return 'File update tidak ditemukan di GitHub (HTTP 404)';
  if (status) return `GitHub membalas HTTP ${status}`;
  if (error?.code === 'ENOTFOUND' || error?.code === 'EAI_AGAIN') {
    return 'Tidak bisa menghubungi GitHub (DNS gagal / tidak ada internet)';
  }
  return error?.message || String(error);
}

/** Unduh sekali ke `dest`. Melempar error bila gagal di tahap mana pun. */
async function unduhSekali(url, dest) {
  const controller = new AbortController();
  let timer;
  const setelUlangTimer = () => {
    clearTimeout(timer);
    timer = setTimeout(
      () => controller.abort(new Error('Download macet (tidak ada data selama 60 detik)')),
      BATAS_MACET_MS,
    );
  };

  setelUlangTimer();
  try {
    const res = await axios({
      url,
      responseType: 'stream',
      signal: controller.signal,
      timeout: BATAS_MACET_MS, // batas menunggu respons pertama
      maxRedirects: 5,
    });

    await new Promise((resolve, reject) => {
      const w = fs.createWriteStream(dest);
      res.data.on('data', setelUlangTimer);
      // Dulu hanya error penulisan file yang ditangani. Koneksi yang putus di
      // tengah download membuat promise ini tidak pernah selesai.
      res.data.on('error', (err) => {
        w.destroy();
        reject(err);
      });
      controller.signal.addEventListener('abort', () => {
        const alasan = controller.signal.reason || new Error('Download dibatalkan');
        res.data.destroy(alasan);
        w.destroy();
        reject(alasan);
      });
      w.on('finish', resolve);
      w.on('error', reject);
      res.data.pipe(w);
    });
  } finally {
    clearTimeout(timer);
  }

  // Zip yang terpotong/berisi halaman error akan gagal saat extract dengan
  // pesan yang membingungkan — cek tanda tangan zip ("PK") lebih dulu.
  const fd = fs.openSync(dest, 'r');
  const kepala = Buffer.alloc(2);
  try {
    fs.readSync(fd, kepala, 0, 2, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (kepala.toString('ascii') !== 'PK') {
    throw new Error('File yang terunduh bukan zip yang valid (kemungkinan terpotong)');
  }
}

/**
 * Unduh file update dengan maksimal MAX_PERCOBAAN kali percobaan.
 * @param {(percobaan:number, error:Error) => Promise<void>} [onRetry]
 */
async function unduhUpdate(url, dest, onRetry) {
  let errorTerakhir;
  let jumlahPercobaan = 0;
  for (let percobaan = 1; percobaan <= MAX_PERCOBAAN; percobaan++) {
    jumlahPercobaan = percobaan;
    try {
      await unduhSekali(url, dest);
      return;
    } catch (error) {
      errorTerakhir = error;
      await fse.remove(dest).catch(() => {}); // buang file setengah jadi
      console.log(`⚠️ Download update gagal (${percobaan}/${MAX_PERCOBAAN}): ${jelaskanError(error)}`);

      if (percobaan === MAX_PERCOBAAN || !bisaDicobaUlang(error)) break;
      await onRetry?.(percobaan + 1, error);
      await delay(JEDA_PERCOBAAN_MS[percobaan - 1] ?? 10000);
    }
  }
  const err = new Error(jelaskanError(errorTerakhir));
  err.cause = errorTerakhir;
  err.jumlahPercobaan = jumlahPercobaan;
  throw err;
}

// copy kuat (anti gagal)
async function forceCopy(src, dest, retry = 5) {
  for (let i = 0; i < retry; i++) {
    try {
      await fse.copy(src, dest, {
        overwrite: true,
        errorOnExist: false,
      });
      return;
    } catch (e) {
      if (i === retry - 1) throw e;
      await delay(800);
    }
  }
}

// proses apply update (dipakai saat start ulang)
export async function applyUpdateIfExists() {
  const cwd = process.cwd();
  const lockFile = path.join(cwd, 'update.lock');
  const tmp = path.join(cwd, 'update_temp');

  if (!fs.existsSync(lockFile)) return;

  console.log('🔁 Melanjutkan update...');

  try {
    const dirs = fs.readdirSync(tmp).filter((f) => {
      const full = path.join(tmp, f);
      return fs.existsSync(full) && fs.statSync(full).isDirectory();
    });

    if (!dirs.length) throw new Error('Folder update tidak ditemukan');

    const source = path.join(tmp, dirs[0]);

    // hapus lama
    console.log('🧹 Cleaning...');
    for (const item of fs.readdirSync(cwd)) {
      if (WHITELIST.has(item)) continue;

      const p = path.join(cwd, item);
      try {
        await fse.remove(p);
        console.log('[REMOVE]', item);
      } catch {
        console.log('[LOCKED]', item);
      }
    }

    // copy baru
    console.log('🚀 Copying...');
    for (const item of fs.readdirSync(source)) {
      if (WHITELIST.has(item)) continue;

      const srcPath = path.join(source, item);
      const destPath = path.join(cwd, item);

      try {
        await forceCopy(srcPath, destPath);
        console.log('[COPIED]', item);
      } catch {
        console.log('[SKIPPED]', item);
      }
    }

    // cleanup
    await fse.remove(tmp);
    await fse.remove(path.join(cwd, 'update.zip'));
    await fse.remove(lockFile);

    console.log('✅ Update selesai');
  } catch (e) {
    console.error('❌ Gagal apply update:', e.message);
  }
}

// command dari WhatsApp
export async function handle(sock, m) {
  const jid = m.remoteJid;
  const cwd = process.cwd();

  await sock.sendMessage(jid, {
    react: { text: '⏳', key: m.message.key },
  });

  const zip = path.join(cwd, 'update.zip');
  const tmp = path.join(cwd, 'update_temp');
  const lockFile = path.join(cwd, 'update.lock');

  try {
    await fse.remove(tmp);
    await fse.ensureDir(tmp);

    // DOWNLOAD (maksimal 3x percobaan, lihat unduhUpdate)
    console.log('⬇️ Downloading...');
    await unduhUpdate(serverUrl, zip, async (percobaan, error) => {
      await sock
        .sendMessage(jid, {
          text: `⚠️ ${jelaskanError(error)}\n🔁 Mencoba lagi (${percobaan}/${MAX_PERCOBAAN})...`,
        })
        .catch(() => {});
    });

    // EXTRACT
    console.log('📦 Extracting...');
    await extract(zip, { dir: tmp });

    await delay(500); // penting

    // cek folder hasil extract
    const dirs = fs.readdirSync(tmp).filter((f) => {
      const full = path.join(tmp, f);
      return fs.existsSync(full) && fs.statSync(full).isDirectory();
    });

    if (!dirs.length) throw new Error('Extract gagal');

    // buat lock (biar lanjut setelah restart)
    fs.writeFileSync(lockFile, 'updating');

    await sock.sendMessage(jid, {
      text: `✅ File update sudah siap\n🔄 Restarting untuk apply update...`,
      quoted: m.message,
    });

    setTimeout(() => process.exit(0), 1500);
  } catch (e) {
    console.error('❌ Update gagal:', e.message);

    // Sisa download/extract yang gagal tidak boleh tertinggal. update.lock
    // belum dibuat di titik mana pun yang bisa gagal, jadi aman.
    await fse.remove(zip).catch(() => {});
    await fse.remove(tmp).catch(() => {});

    const infoPercobaan = e.jumlahPercobaan > 1 ? `\n\nSudah dicoba ${e.jumlahPercobaan}x.` : '';
    await sock.sendMessage(jid, {
      text: `❌ UPDATE FAILED\n${e.message}${infoPercobaan}\nSilakan ulangi *.update* beberapa menit lagi.`,
      quoted: m.message,
    });
  }
}

export default {
  handle,
  Commands: ['update'],
  OnlyPremium: false,
  OnlyOwner: true,
};
