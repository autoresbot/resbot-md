import { reply } from "../../lib/utils.js";
import fs from "fs";
import { execSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

async function handle(sock, messageInfo) {
  const { m, remoteJid, message } = messageInfo;

  let oldVersion = "Tidak ditemukan";
  let newVersion = "Tidak ditemukan";
  let updateInfo = "";

  try {
    // Dapatkan versi lama Baileys
    const pkgPath = require.resolve("baileys/package.json");
    const pkg = require(pkgPath);
    oldVersion = pkg.version;
  } catch (error) {
    console.warn("[!] Gagal membaca versi lama Baileys:", error.message);
  }

  try {
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    execSync("npm install baileys", { stdio: "ignore" });

    // Hapus cache require supaya bisa baca versi baru
    const resolvedPath = require.resolve("baileys/package.json");
    delete require.cache[resolvedPath];

    const newPkg = require(resolvedPath);
    newVersion = newPkg.version || "Tidak ditemukan";

    if (newVersion !== oldVersion) {
      updateInfo = `✅ *baileys* berhasil diperbarui dari v${oldVersion} ke v${newVersion}`;
    } else {
      updateInfo = `✅ *baileys* sudah versi terbaru: v${newVersion}`;
    }
  } catch (err) {
    console.error("[!] Gagal update baileys:", err.message);
    updateInfo = "❌ Terjadi kesalahan saat memperbarui *baileys*";
  }

  await reply(m, updateInfo);
}

export default {
  handle,
  Commands: ["updatebaileys", "updatebailey"],
  OnlyPremium: false,
  OnlyOwner: false,
};
