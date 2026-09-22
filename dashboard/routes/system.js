/**
 * Info sistem, statistik, form config, dan pembaca log.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import { getDb } from '../../lib/database.js';
import { HttpError, writeConfigFile } from '../lib/files.js';
import { ConfigFormError, readConfigForm, applyConfigForm } from '../lib/configForm.js';

const MAX_LOG_LINES = 500;
const PLUGIN_CACHE_MS = 60 * 1000;

function createSystemRouter({ rootDir, config, runtime, auth }) {
  const router = express.Router();
  const configFile = path.join(rootDir, 'config.js');
  const logDir = path.join(rootDir, 'logs');

  // Hitung plugin cukup sesekali; folder plugins jarang berubah.
  let pluginCache = { at: 0, count: 0 };
  function countPlugins() {
    if (Date.now() - pluginCache.at < PLUGIN_CACHE_MS) return pluginCache.count;
    let count = 0;
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) walk(path.join(dir, entry.name));
        else if (entry.name.endsWith('.js')) count++;
      }
    };
    try {
      walk(path.join(rootDir, 'plugins'));
    } catch {
      // folder plugins tidak ada
    }
    pluginCache = { at: Date.now(), count };
    return count;
  }

  function countRows(sql) {
    try {
      return getDb().prepare(sql).get().c;
    } catch {
      return null;
    }
  }

  router.get('/profile', (req, res) => {
    res.json({
      name: config.owner_name || 'Admin',
      role: 'Administrator',
      passwordGenerated: auth.generated,
    });
  });

  router.get('/status', (req, res) => {
    const mem = process.memoryUsage();
    const connected = global.statusConnected || {};
    const mainNumber = config.phone_number_bot;

    res.json({
      version: global.version || config.version || '-',
      node: process.version,
      platform: `${os.platform()}/${os.arch()}`,
      panel: runtime.panel,
      port: runtime.port,
      uptime: Math.floor(process.uptime()),
      memory: { rss: mem.rss, heapUsed: mem.heapUsed },
      system: { total: os.totalmem(), free: os.freemem(), cpus: os.cpus().length, load: os.loadavg()[0] },
      bot: {
        number: mainNumber,
        connected: connected[mainNumber] === true,
        sessions: Object.entries(connected).map(([id, status]) => ({ id, connected: status })),
      },
      stats: {
        users: countRows('SELECT COUNT(*) AS c FROM users'),
        premium: countRows('SELECT COUNT(*) AS c FROM users WHERE premium IS NOT NULL AND premium != \'\''),
        groups: countRows('SELECT COUNT(*) AS c FROM groups_data'),
        sewa: countRows('SELECT COUNT(*) AS c FROM sewa'),
        plugins: countPlugins(),
      },
      startedAt: runtime.startedAt,
    });
  });

  router.get('/config', (req, res) => {
    res.json({ categories: readConfigForm(fs.readFileSync(configFile, 'utf-8')) });
  });

  router.put('/config', (req, res) => {
    const source = fs.readFileSync(configFile, 'utf-8');
    let result;
    try {
      result = applyConfigForm(source, req.body?.values);
    } catch (err) {
      if (err instanceof ConfigFormError) throw new HttpError(400, err.message);
      throw err;
    }
    if (result.changed.length) writeConfigFile(rootDir, result.source);
    res.json({ ok: true, changed: result.changed });
  });

  router.get('/logs', (req, res) => {
    const files = fs.existsSync(logDir)
      ? fs
          .readdirSync(logDir)
          .filter((name) => fs.statSync(path.join(logDir, name)).isFile())
          .sort()
      : [];

    const name = path.basename(String(req.query.file || ''));
    if (!name) return res.json({ files });

    const file = path.join(logDir, name);
    if (!files.includes(name)) throw new HttpError(404, 'File log tidak ditemukan.');

    // Ambil bagian akhir saja supaya log besar tidak membebani.
    const { size } = fs.statSync(file);
    const readSize = Math.min(size, 512 * 1024);
    const buffer = Buffer.alloc(readSize);
    const fd = fs.openSync(file, 'r');
    try {
      fs.readSync(fd, buffer, 0, readSize, size - readSize);
    } finally {
      fs.closeSync(fd);
    }
    const lines = buffer.toString('utf-8').split(/\r?\n/);
    res.json({ files, file: name, content: lines.slice(-MAX_LOG_LINES).join('\n') });
  });

  return router;
}

export { createSystemRouter };
