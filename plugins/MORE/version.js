import { reply } from "../../lib/utils.js";
import config from "../../config.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

async function handle(sock, messageInfo) {
  const { m } = messageInfo;
  let baileysVersion = "Tidak ditemukan";

  try {
    // Cari path package.json Baileys
    const pkgPath = path.resolve("node_modules/baileys/package.json");
    const pkgData = fs.readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(pkgData);

    baileysVersion = pkg.version;
  } catch (error) {
    console.warn("[!] Gagal membaca versi Baileys:", error.message);
  }

  const responseText = [
    `◧ ᴠᴇʀꜱɪ ꜱᴄ : ${global.version}`,
    `◧ ʙᴀɪʟᴇʏꜱ   : v${baileysVersion}`,
  ].join("\n");

  await reply(m, responseText);
}

export default {
  handle,
  Commands: ["version", "versi"],
  OnlyPremium: false,
  OnlyOwner: false,
};
