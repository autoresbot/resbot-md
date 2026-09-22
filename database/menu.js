import fs from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";

const pluginsDir = path.join(process.cwd(), "plugins");

let cachedMenu = {};
let lastUpdate = 0;
const CACHE_INTERVAL = 30 * 1000; // 30 detik

/**
 * Tentukan command mana dari sebuah plugin yang tampil di menu.
 *
 * Ada DUA jenis plugin yang punya banyak entri di `Commands`, dan keduanya
 * tidak boleh diperlakukan sama:
 *
 *  1. ALIAS untuk satu fitur yang sama — mis.
 *     `["editsubjek", "editsubject", "editsubjeck", "editjudul"]`.
 *     Kalau semuanya ditampilkan, satu fitur muncul empat kali di menu.
 *
 *  2. FITUR BERBEDA yang kebetulan satu berkas — mis. `plugins/ANIME/anime.js`
 *     yang memakai `command` untuk memilih endpoint (`waifu`, `neko`, `hug`, …).
 *     Di sini semuanya memang harus tampil.
 *
 * Karena tidak ada cara aman menebaknya dari kode, pluginnya yang menyatakan
 * lewat `MenuCommands`:
 *
 *   MenuCommands: "all"            -> tampilkan semua Commands
 *   MenuCommands: ["a", "b"]       -> tampilkan tepat yang disebut
 *   (tidak diisi)                  -> tampilkan SATU alias saja (lihat di bawah)
 *
 * Saat tidak diisi, alias yang ditampilkan dipilih begini:
 *
 *   1. Alias yang cocok dengan NAMA BERKAS (spasi/tanda baca diabaikan).
 *      `cak lontong.js` punya Commands ["cak", "caklontong"] -> tampil
 *      "caklontong", bukan "cak". Nama berkas adalah nama yang diberi penulis
 *      untuk fitur itu, jadi sinyalnya jauh lebih baik daripada urutan array
 *      yang sering diawali singkatan.
 *   2. Kalau tidak ada yang cocok, barulah `Commands[0]`.
 *
 * Apa pun pilihannya, SELURUH alias tetap bisa diketik user — dispatch command
 * memakai `plugin.Commands` langsung, tidak lewat data menu ini.
 */
function resolveMenuCommands(pluginDefault, fileName = "") {
  const { Commands, MenuCommands } = pluginDefault ?? {};
  if (!Array.isArray(Commands)) return [];

  const bersih = (list) =>
    list.filter((cmd) => typeof cmd === "string" && cmd.trim()).map((cmd) => cmd.trim());

  const semua = bersih(Commands);
  if (semua.length === 0) return [];

  if (MenuCommands === "all" || MenuCommands === true) return semua;
  if (Array.isArray(MenuCommands)) {
    const dipilih = bersih(MenuCommands);
    if (dipilih.length > 0) return dipilih;
  }

  const dariNamaFile = normalisasi(fileName.replace(/\.js$/i, ""));
  const cocok = semua.find((cmd) => normalisasi(cmd) === dariNamaFile);

  return [cocok ?? semua[0]];
}

/** Samakan bentuk untuk dibandingkan: huruf & angka saja, huruf kecil. */
function normalisasi(teks) {
  return String(teks)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

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

        commands.push(...resolveMenuCommands(pluginDefault, file));
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

/**
 * Sidik jari folder plugins: nama file + waktu ubah + ukuran. Cukup `stat`
 * (tanpa membaca/meng-import file), jadi murah dijalankan tiap 30 detik.
 */
async function pluginsSignature() {
  const parts = [];
  const dirents = await fs.readdir(pluginsDir, { withFileTypes: true });
  for (const dirent of dirents) {
    if (!dirent.isDirectory()) continue;
    const categoryPath = path.join(pluginsDir, dirent.name);
    for (const file of await fs.readdir(categoryPath)) {
      if (!file.endsWith(".js")) continue;
      const stat = await fs.stat(path.join(categoryPath, file));
      parts.push(`${dirent.name}/${file}:${stat.mtimeMs}:${stat.size}`);
    }
  }
  return parts.sort().join("|");
}

let lastSignature = "";

// Pastikan menu sudah di-load, dipanggil sebelum akses
//
// Dulu SETIAP 30 detik (saat ada yang memanggil .menu) seluruh ±344 plugin
// di-import ulang dengan ?cacheBust. Tiap import ulang memakan ratusan ms CPU
// dan menambah memori yang tidak pernah dilepas (modul ESM tidak bisa
// dibuang dari cache). Sekarang plugin hanya di-import ulang kalau ada file
// plugin yang benar-benar berubah/bertambah/terhapus.
export async function loadMenuOnce() {
  const now = Date.now();
  const empty = Object.keys(cachedMenu).length === 0;
  if (!empty && now - lastUpdate <= CACHE_INTERVAL) return cachedMenu;

  const signature = await pluginsSignature().catch(() => "");
  if (empty || !signature || signature !== lastSignature) {
    cachedMenu = await loadMenu();
    lastSignature = signature;
  }
  lastUpdate = now;
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
