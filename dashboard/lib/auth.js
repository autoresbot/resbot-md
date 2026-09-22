/**
 * auth.js - Login dashboard (password tunggal + cookie bertanda tangan HMAC).
 *
 * Dashboard bisa mengubah file & database, jadi siapa pun yang lolos login
 * praktis memegang server. Karena itu:
 *  - password kosong di config => dibuat acak & disimpan di database/dashboard.json
 *  - percobaan login gagal dibatasi per IP
 *  - request yang mengubah data wajib membawa header X-Dashboard (tidak bisa
 *    dikirim oleh form/situs lain), ditambah cookie SameSite=Strict
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const COOKIE_NAME = 'resbot_dash';
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 hari
const MAX_FAILED = 3; // maksimal 3 password salah ...
const FAIL_WINDOW = 60 * 1000; // ... dalam 1 menit

/**
 * @param {object} opts
 * @param {(newPassword: string) => boolean} opts.savePasswordToConfig
 *   menulis password ke config.js; false jika config.js tidak punya DASHBOARD_PASSWORD
 */
function createAuth({ rootDir, password, savePasswordToConfig }) {
  const secretFile = path.join(rootDir, 'database', 'dashboard.json');

  let stored = {};
  try {
    stored = JSON.parse(fs.readFileSync(secretFile, 'utf-8'));
  } catch {
    stored = {};
  }

  let changed = false;
  if (!stored.secret) {
    stored.secret = crypto.randomBytes(32).toString('hex');
    changed = true;
  }
  if (!password && !stored.password) {
    stored.password = crypto.randomBytes(6).toString('base64url');
    changed = true;
  }
  if (changed) {
    fs.mkdirSync(path.dirname(secretFile), { recursive: true });
    fs.writeFileSync(secretFile, JSON.stringify(stored, null, 2));
  }

  let activePassword = password || stored.password;
  // Config lama (tanpa DASHBOARD_PASSWORD) menyimpan password hasil "Ganti
  // Password" di dashboard.json; itu bukan lagi password otomatis.
  let generated = !password && !stored.passwordChanged;
  // Sesi lama otomatis tidak berlaku lagi saat password diganti.
  const makeTag = (pw) =>
    crypto.createHmac('sha256', stored.secret).update(pw).digest('hex').slice(0, 16);
  let passwordTag = makeTag(activePassword);

  const sign = (data) =>
    crypto.createHmac('sha256', stored.secret).update(data).digest('base64url');

  const safeEqual = (a, b) => {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
  };

  function createToken() {
    const payload = Buffer.from(
      JSON.stringify({ exp: Date.now() + SESSION_TTL, tag: passwordTag }),
    ).toString('base64url');
    return `${payload}.${sign(payload)}`;
  }

  function verifyToken(token) {
    if (!token || !token.includes('.')) return false;
    const [payload, signature] = token.split('.');
    if (!safeEqual(signature, sign(payload))) return false;
    try {
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
      return data.tag === passwordTag && data.exp > Date.now();
    } catch {
      return false;
    }
  }

  function readCookie(req) {
    const header = req.headers.cookie || '';
    for (const part of header.split(';')) {
      const [key, ...rest] = part.trim().split('=');
      if (key === COOKIE_NAME) return decodeURIComponent(rest.join('='));
    }
    return null;
  }

  function setCookie(res, value, maxAge) {
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(maxAge / 1000)}`,
    );
  }

  // ─── Pembatas login gagal per IP (jendela geser) ──
  const failed = new Map(); // ip -> [waktu gagal, ...] dalam FAIL_WINDOW terakhir

  /** Sisa detik tunggu, atau 0 jika IP ini boleh mencoba lagi. */
  function waitSeconds(ip) {
    const now = Date.now();
    const times = (failed.get(ip) || []).filter((t) => now - t < FAIL_WINDOW);
    if (times.length) failed.set(ip, times);
    else failed.delete(ip);
    if (times.length < MAX_FAILED) return 0;
    return Math.ceil((times[0] + FAIL_WINDOW - now) / 1000);
  }

  const tooMany = (res, wait) =>
    res.status(429).json({
      error: `Terlalu banyak percobaan. Tunggu ${wait} detik lagi.`,
      retryAfter: wait,
    });

  function login(req, res) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    // Jaga agar map tidak membengkak oleh banyak IP berbeda.
    if (failed.size > 5000) for (const key of failed.keys()) waitSeconds(key);
    const wait = waitSeconds(ip);
    if (wait) return tooMany(res, wait);

    const input = String(req.body?.password || '');
    if (!safeEqual(input, activePassword)) {
      failed.set(ip, [...(failed.get(ip) || []), Date.now()]);
      const next = waitSeconds(ip);
      if (next) return tooMany(res, next);
      const left = MAX_FAILED - failed.get(ip).length;
      return res.status(401).json({ error: `Password salah. Sisa ${left} percobaan.` });
    }

    failed.delete(ip);
    setCookie(res, createToken(), SESSION_TTL);
    res.json({ ok: true });
  }

  function logout(req, res) {
    setCookie(res, '', 0);
    res.json({ ok: true });
  }

  /**
   * Ganti password: langsung berlaku tanpa restart. Disimpan ke config.js
   * (DASHBOARD_PASSWORD) agar tetap satu sumber; config lama tanpa konstanta
   * itu memakai database/dashboard.json.
   */
  function changePassword(req, res) {
    const { oldPassword, newPassword } = req.body || {};
    if (!safeEqual(String(oldPassword || ''), activePassword)) {
      return res.status(400).json({ error: 'Password lama salah.' });
    }
    const next = String(newPassword || '');
    if (next.length < 6) {
      return res.status(400).json({ error: 'Password baru minimal 6 karakter.' });
    }
    if (next.length > 128 || /[\r\n]/.test(next)) {
      return res.status(400).json({ error: 'Password baru tidak valid.' });
    }

    if (!savePasswordToConfig(next)) {
      stored.password = next;
      stored.passwordChanged = true;
      fs.writeFileSync(secretFile, JSON.stringify(stored, null, 2));
    }

    activePassword = next;
    generated = false;
    passwordTag = makeTag(next);
    // Sesi lain keluar otomatis; sesi yang sedang dipakai diberi cookie baru.
    setCookie(res, createToken(), SESSION_TTL);
    res.json({ ok: true });
  }

  /** Middleware: wajib login untuk semua /api kecuali login. */
  function requireAuth(req, res, next) {
    if (!verifyToken(readCookie(req))) {
      return res.status(401).json({ error: 'Belum login.' });
    }
    if (req.method !== 'GET' && req.headers['x-dashboard'] !== '1') {
      return res.status(403).json({ error: 'Request ditolak.' });
    }
    next();
  }

  return {
    login,
    logout,
    changePassword,
    requireAuth,
    isLoggedIn: (req) => verifyToken(readCookie(req)),
    get password() {
      return activePassword;
    },
    get generated() {
      return generated;
    },
    secretFile,
  };
}

export { createAuth };
