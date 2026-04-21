import fs from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";

const pluginsDir = path.join(process.cwd(), "plugins");

let cachedMenu = {};
let lastUpdate = 0;
const CACHE_INTERVAL = 30 * 1000; // 30 detik

// Load semua plugin dan buat menu
async function loadMenu() {
  const menu = {};
  const dirents = await fs.readdir(pluginsDir, { withFileTypes: true });

  for (const dirent of dirents) {
    if (!dirent.isDirectory()) continue;

    const category = dirent.name.toLowerCase();
    const categoryPath = path.join(pluginsDir, dirent.name);
    const commands = [];

    const files = await fs.readdir(categoryPath);
    for (const file of files) {
      if (!file.endsWith(".js")) continue;

      const filePath = path.join(categoryPath, file);

      try {
        const moduleURL =
          pathToFileURL(filePath).href + "?cacheBust=" + Date.now();
        const plugin = await import(moduleURL);
        const pluginDefault = plugin.default || plugin;

        if (pluginDefault.Commands && Array.isArray(pluginDefault.Commands)) {
          commands.push(...pluginDefault.Commands);
        }
      } catch (err) {
        console.error(`❌ Gagal load file ${filePath}:`, err.message);
      }
    }

    if (commands.length > 0) {
      menu[category] = [...new Set(commands)];
    }
  }

  return menu;
}

// Pastikan menu sudah di-load, dipanggil sebelum akses
export async function loadMenuOnce() {
  const now = Date.now();
  if (
    now - lastUpdate > CACHE_INTERVAL ||
    Object.keys(cachedMenu).length === 0
  ) {
    cachedMenu = await loadMenu();
    lastUpdate = now;
  }
  return cachedMenu;
}

// Proxy tetap bisa dipakai untuk akses langsung (non-await)
const menuProxy = new Proxy(
  {},
  {
    get(target, prop) {
      // Cek cache tapi tidak await
      loadMenuOnce().catch(console.error);
      return cachedMenu[prop];
    },
    ownKeys() {
      loadMenuOnce().catch(console.error);
      return Reflect.ownKeys(cachedMenu);
    },
    getOwnPropertyDescriptor() {
      loadMenuOnce().catch(console.error);
      return { enumerable: true, configurable: true };
    },
  }
);

export default menuProxy;
