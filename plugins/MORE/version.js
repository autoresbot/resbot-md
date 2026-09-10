import { reply } from "../../lib/utils.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

async function handle(sock, messageInfo) {
  const { m } = messageInfo;
  let zapoVersion = "Tidak ditemukan";

  try {
    // Diresolve lewat module resolution, bukan path relatif ke cwd — bot bisa
    // dijalankan dari direktori mana saja (mis. lewat pm2 / systemd).
    zapoVersion = require("zapo-js/package.json").version;
  } catch (error) {
    console.warn("[!] Gagal membaca versi zapo-js:", error.message);
  }

  const responseText = [
    `◧ ᴠᴇʀꜱɪ ꜱᴄ : ${global.version}`,
    `◧ ᴢᴀᴘᴏ-ᴊꜱ  : v${zapoVersion}`,
  ].join("\n");

  await reply(m, responseText);
}

export default {
  handle,
  Commands: ["version", "versi"],
  OnlyPremium: false,
  OnlyOwner: false,
};
