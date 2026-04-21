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

  try {
    const zip = path.join(cwd, 'update.zip');
    const tmp = path.join(cwd, 'update_temp');
    const lockFile = path.join(cwd, 'update.lock');

    await fse.remove(tmp);
    await fse.ensureDir(tmp);

    // DOWNLOAD
    console.log('⬇️ Downloading...');
    const res = await axios({ url: serverUrl, responseType: 'stream' });

    await new Promise((resolve, reject) => {
      const w = fs.createWriteStream(zip);
      res.data.pipe(w);
      w.on('finish', resolve);
      w.on('error', reject);
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
    console.error(e);

    await sock.sendMessage(jid, {
      text: `❌ UPDATE FAILED\n${e.message}`,
      quoted: m.message,
    });
  }
}

export default {
  handle,
  Commands: ['update'],
};
