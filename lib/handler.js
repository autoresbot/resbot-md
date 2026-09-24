import fs from 'fs';
import path from 'path';
import config from '../config.js';
import { logWithTime } from './utils.js';
import { logHandlerError } from './errorLogger.js'; // FIX: error logger global
import { pathToFileURL } from 'url';
import { chatError } from './trace.js';

const mode = config.mode; // Bisa 'production' atau 'development'

const handlers = [];

// Fungsi rekursif untuk membaca semua file `.js` dari folder dan sub-folder
async function loadHandlers(dir) {
  const files = await fs.promises.readdir(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stats = await fs.promises.stat(fullPath);

    if (stats.isDirectory()) {
      await loadHandlers(fullPath); // rekursi jika folder
    } else if (file.endsWith('.js')) {
      try {
        const module = await import(pathToFileURL(fullPath).href + `?update=${Date.now()}`);
        const handler = module.default || module;

        if (typeof handler.process === 'function') {
          if (typeof handler.priority === 'undefined') {
            handler.priority = 100; // default priority
          }
          // Sebagian handler (terutama folder GAMES) tidak mengisi `name`.
          // Tanpa ini, log "handler mana yang menghentikan pesan" hanya
          // menulis 'anonymous' dan tidak ada gunanya untuk melacak.
          if (!handler.name) {
            handler.name = path.relative(process.cwd(), fullPath).split(path.sep).join('/');
          }
          handlers.push(handler);
        }
      } catch (err) {
        console.error(`❌ Gagal load handler ${fullPath}:`, err.message);
      }
    }
  }
}

// Fungsi inisialisasi untuk load semua handler dan urutkan berdasarkan priority
export async function initHandlers() {
  // Kosongkan dulu (mutasi in-place, bukan reassign, agar referensi `handlers`
  // yang sudah diekspor tetap valid). Tanpa ini, pemanggilan initHandlers kedua
  // kali akan menambah salinan handler yang sama sehingga setiap pesan diproses
  // dua kali oleh handler yang sama.
  handlers.length = 0;

  await loadHandlers(path.join(process.cwd(), 'handle')); // folder handle
  handlers.sort((a, b) => a.priority - b.priority);
  logWithTime('System', `Load All Handler done... (${handlers.length} handler)`);
}

// Fungsi preProcess yang diekspor
export async function preProcess(sock, messageInfo) {
  for (const handler of handlers) {
    try {
      const result = await handler.process(sock, messageInfo);

      if (result === false) {
        // Namanya dititipkan ke messageInfo supaya processMessage bisa menulis
        // baris [CHAT BERHENTI] yang menyebut fitur mana yang menghentikan.
        if (messageInfo) messageInfo.dihentikanOleh = handler.name || 'anonymous';
        logWithTime('System', `Handler ${handler.name || 'anonymous'} menghentikan pemrosesan.`);
        return false;
      }
    } catch (error) {
      // Handler yang error TIDAK menghentikan pesan (pemrosesan lanjut ke
      // handler berikutnya), tapi tetap dicatat karena sering jadi penyebab
      // fitur tertentu diam-diam tidak jalan.
      chatError(`Handler: ${handler.name || 'anonymous'}`, error, messageInfo);
      console.error(`Error pada handler ${handler.name || 'anonymous'}:`, error.message);
      // FIX: error logger global - catat error handler ke logs/handler.log
      logHandlerError(error, {
        plugin: handler.name || 'anonymous',
        command: messageInfo?.command,
        sender: messageInfo?.sender,
        remoteJid: messageInfo?.remoteJid,
      });
    }
  }

  return true;
}

export default {
  initHandlers,
  preProcess,
  handlers,
};
