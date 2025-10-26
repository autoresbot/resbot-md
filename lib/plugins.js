import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pluginsPath = path.join(process.cwd(), "plugins");
let plugins = [];

async function loadPlugins(directory) {
  const loadedPlugins = [];

  try {
    const files = fs.readdirSync(directory);

    for (const file of files) {
      const fullPath = path.join(directory, file);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        const subPlugins = await loadPlugins(fullPath);
        loadedPlugins.push(...subPlugins);
      } else if (file.endsWith(".js")) {
        try {
          // Dynamic import ESM untuk Windows & Linux
          const plugin = await import(
            pathToFileURL(fullPath).href + "?cacheBust=" + Date.now()
          );
          loadedPlugins.push(plugin.default || plugin);
        } catch (error) {
          console.error(
            `❌ ERROR : Gagal memuat plugin: ${fullPath} : ${error}`
          );
        }
      }
    }
  } catch (error) {
    console.error(
      `❌ ERROR: Gagal membaca direktori: ${directory} - ${error.message}`
    );
  }

  return loadedPlugins;
}

async function reloadPlugins() {
  plugins = await loadPlugins(pluginsPath);
  if (plugins.length === 0) {
    console.warn("⚠️ WARNING: Tidak ada plugin yang dimuat.");
  }
  return plugins;
}

export { reloadPlugins };
