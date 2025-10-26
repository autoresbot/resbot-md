import fs from "fs";
import path from "path";
import config from "../config.js";
import { logWithTime } from "./utils.js";
import { pathToFileURL } from "url";

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
    } else if (file.endsWith(".js")) {
      try {
        const module = await import(
          pathToFileURL(fullPath).href + `?update=${Date.now()}`
        );
        const handler = module.default || module;

        if (typeof handler.process === "function") {
          if (typeof handler.priority === "undefined") {
            handler.priority = 100; // default priority
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
  await loadHandlers(path.join(process.cwd(), "handle")); // folder handle
  handlers.sort((a, b) => a.priority - b.priority);
  console.log(`[✔] Load All Handler done...`);
  logWithTime("System", `Load All Handler done...`);
}

// Fungsi preProcess yang diekspor
export async function preProcess(sock, messageInfo) {
  let stopProcessing = false;

  for (const handler of handlers) {
    if (stopProcessing) break;

    try {
      const result = await handler.process(sock, messageInfo);

      if (result === false) {
        logWithTime(
          "System",
          `Handler ${handler.name || "anonymous"} menghentikan pemrosesan.`
        );
        stopProcessing = true;
        return false;
      }
    } catch (error) {
      console.error(
        `Error pada handler ${handler.name || "anonymous"}:`,
        error.message
      );
    }
  }

  return true;
}

export default {
  initHandlers,
  preProcess,
  handlers,
};
