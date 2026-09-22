/**
 * Dashboard web Resbot — kelola database, config.js, dan file lewat browser.
 *
 * Prinsip: dashboard hanya PENGONTROL dan tidak boleh mengganggu bot.
 *  - Dijalankan paling akhir, setelah bot WhatsApp terhubung.
 *  - Semua kegagalan (express belum terinstal, port tidak ada / terpakai,
 *    error saat start) hanya dicatat di console, bot tetap berjalan.
 *  - Tidak memasang handler proses global apa pun.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';
import { resolvePort, isPortFree } from './lib/port.js';
import { success, warning, danger } from '../lib/utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const READY_POLL_MS = 2000;
const READY_TIMEOUT_MS = 3 * 60 * 1000; // tetap jalan walau bot belum terhubung (mis. perlu pairing)
const AFTER_READY_DELAY_MS = 5000; // beri waktu bot menyelesaikan tugas awal setelah online

// Format sama dengan log bot lainnya: "[jam:menit] Dashboard : pesan", dengan
// warna sesuai jenisnya (hijau = aktif, kuning = dilewati, merah = error).
const log = {
  ok: (msg) => success('Dashboard', msg),
  warn: (msg) => warning('Dashboard', msg),
  error: (msg) => danger('Dashboard', msg),
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isBotReady() {
  return global.statusConnected?.[config.phone_number_bot] === true;
}

async function waitForBot() {
  const start = Date.now();
  while (!isBotReady()) {
    if (Date.now() - start > READY_TIMEOUT_MS) {
      log.warn('Bot belum terhubung, dashboard tetap dijalankan.');
      return;
    }
    await sleep(READY_POLL_MS);
  }
  await sleep(AFTER_READY_DELAY_MS);
}

async function startDashboard() {
  const dashConfig = config.dashboard || {};
  if (dashConfig.enabled === false) return;

  const target = resolvePort(dashConfig);
  if (!target.port) {
    log.warn(`Tidak dijalankan: ${target.reason}.`);
    return;
  }

  let express;
  try {
    express = (await import('express')).default;
  } catch {
    log.warn('Tidak dijalankan: module "express" belum terinstal (jalankan: npm install).');
    return;
  }

  await waitForBot();

  if (!(await isPortFree(target.port, target.host))) {
    log.warn(`Tidak dijalankan: port ${target.port} sudah dipakai proses lain.`);
    return;
  }

  const { createAuth } = await import('./lib/auth.js');
  const { HttpError, writeConfigFile } = await import('./lib/files.js');
  const { replaceValue } = await import('./lib/configForm.js');
  const { default: databaseRouter } = await import('./routes/database.js');
  const { createFilesRouter } = await import('./routes/files.js');
  const { createSystemRouter } = await import('./routes/system.js');
  const { createCustomRouter } = await import('./routes/custom.js');
  const { createStringsRouter } = await import('./routes/strings.js');

  // Password baru ditulis ke DASHBOARD_PASSWORD di config.js. Mengembalikan
  // false bila config.js lama belum punya konstanta itu.
  const savePasswordToConfig = (newPassword) => {
    const configFile = path.join(ROOT_DIR, 'config.js');
    const source = fs.readFileSync(configFile, 'utf-8');
    const next = replaceValue(source, { const: 'DASHBOARD_PASSWORD', type: 'text' }, newPassword);
    if (next === null) return false;
    writeConfigFile(ROOT_DIR, next);
    if (config.dashboard) config.dashboard.password = newPassword;
    return true;
  };

  const auth = createAuth({ rootDir: ROOT_DIR, password: dashConfig.password, savePasswordToConfig });
  const runtime = { panel: target.panel, port: target.port, startedAt: Date.now() };

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');

  app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; frame-ancestors 'none'",
    );
    next();
  });

  app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

  const api = express.Router();
  api.use(express.json({ limit: '10mb' }));
  api.post('/login', auth.login);
  api.post('/logout', auth.logout);
  api.get('/session', (req, res) => res.json({ loggedIn: auth.isLoggedIn(req) }));
  // Versi script untuk halaman login (tidak rahasia).
  api.get('/info', (req, res) => res.json({ version: global.version || config.version || '' }));
  api.use(auth.requireAuth);
  api.post('/password', auth.changePassword);
  api.use('/db', databaseRouter);
  api.use('/files', createFilesRouter(ROOT_DIR));
  api.use('/system', createSystemRouter({ rootDir: ROOT_DIR, config, runtime, auth }));
  api.use('/custom', createCustomRouter(ROOT_DIR));
  api.use('/strings', createStringsRouter(ROOT_DIR));
  api.use((req, res) => res.status(404).json({ error: 'Endpoint tidak ada.' }));

  // Error handler: semua error dijawab JSON, tidak pernah membuat proses crash.
  api.use((err, req, res, next) => {
    let status = 500;
    if (err instanceof HttpError) status = err.status;
    else if (err?.code?.startsWith?.('SQLITE_') || err?.name === 'SqliteError') status = 400;
    else if (err?.type === 'entity.parse.failed') status = 400;
    else if (err?.type === 'entity.too.large') status = 413;
    if (status === 500) log.error(`Error: ${err?.stack || err}`);
    res.status(status).json({ error: err?.message || 'Terjadi kesalahan.' });
  });

  app.use('/api', api);

  const server = app.listen(target.port, target.host);
  server.on('error', (err) => log.error(`Server berhenti: ${err.message}`));
  server.on('listening', () => {
    let shownHost = target.host;
    if (target.panel) {
      const ip = process.env.SERVER_IP;
      shownHost = ip && ip !== '0.0.0.0' ? ip : 'IP-server-panel';
    }
    log.ok(`Aktif di http://${shownHost}:${target.port}`);
    if (auth.generated) {
      log.ok(`Password: ${auth.password}  (tersimpan di database/dashboard.json)`);
    }
  });
}

export { startDashboard };
