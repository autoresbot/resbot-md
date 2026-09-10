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
    // Dapatkan versi lama zapo-js
    const pkgPath = require.resolve("zapo-js/package.json");
    const pkg = require(pkgPath);
    oldVersion = pkg.version;
  } catch (error) {
    console.warn("[!] Gagal membaca versi lama zapo-js:", error.message);
  }

  try {
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    execSync("npm install zapo-js", { stdio: "ignore" });

    // Hapus cache require supaya bisa baca versi baru
    const resolvedPath = require.resolve("zapo-js/package.json");
    delete require.cache[resolvedPath];

    const newPkg = require(resolvedPath);
    newVersion = newPkg.version || "Tidak ditemukan";

    if (newVersion !== oldVersion) {
      updateInfo = `✅ *zapo-js* berhasil diperbarui dari v${oldVersion} ke v${newVersion}`;
    } else {
      updateInfo = `✅ *zapo-js* sudah versi terbaru: v${newVersion}`;
    }
  } catch (err) {
    console.error("[!] Gagal update zapo-js:", err.message);
    updateInfo = "❌ Terjadi kesalahan saat memperbarui *zapo-js*";
  }

  await reply(m, updateInfo);
}

export default {
  handle,
  Commands: ["updatezapo", "updatebaileys", "updatebailey"],
  // Nama berkasnya masih "updatebaileys" (biar link lama tak putus), tapi
  // fiturnya sekarang meng-update zapo-js. Label menu ditulis eksplisit.
  MenuCommands: ["updatezapo"],
  OnlyPremium: false,
  OnlyOwner: true,
};
