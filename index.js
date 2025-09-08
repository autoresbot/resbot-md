/*
⚠️ PERINGATAN:
Script ini **TIDAK BOLEH DIPERJUALBELIKAN** dalam bentuk apa pun!

╔══════════════════════════════════════════════╗
║                🛠️ INFORMASI SCRIPT           ║
╠══════════════════════════════════════════════╣
║ 📦 Version   : 4.3.1
║ 👨‍💻 Developer  : Azhari Creative              ║
║ 🌐 Website    : https://autoresbot.com       ║
║ 💻 GitHub  : github.com/autoresbot/resbot-md ║
╚══════════════════════════════════════════════╝

📌 Mulai 11 April 2025,
Script **Autoresbot** resmi menjadi **Open Source** dan dapat digunakan secara gratis:
🔗 https://autoresbot.com
*/

console.log(`[✔] Start App ...`);

// Mewajibkan untuk menggunakan versi node js 20
const [major] = process.versions.node.split(".").map(Number);

if (major < 20 || major >= 21) {
  console.error(`❌ Script ini hanya kompatibel dengan Node.js versi 20.x`);
  console.error(
    `ℹ️  Jika kamu menjalankan script ini melalui panel, buka menu *Startup*, lalu ubah *Docker Image* ke versi Node.js 20`
  );

  // Tunggu 60 detik sebelum keluar
  setTimeout(() => {
    process.exit(1);
  }, 60_000);
  return;
}

process.env.TZ = "Asia/Jakarta"; // Lokasi Timezone utama
require("module-alias/register");
require("@lib/version");

const { checkAndInstallModules } = require("@lib/utils");
const config = require("@config");
const axios = require("axios");

(async () => {
  try {
    // Cek dan install semua module yang diperlukan
    await checkAndInstallModules([
      "follow-redirects",
      "jimp@1.6.0",
      "qrcode-reader",
      "wa-sticker-formatter",
      "baileys@6.7.19",
      "api-autoresbot@1.0.6",
    ]);

    const { start_app } = require("@lib/startup");
    await start_app();
  } catch (err) {
    console.error("Error dalam proses start_app:", err.message);
    await reportCrash("inactive");
    process.exit(1);
  }
})();

const BOT_NUMBER = config.phone_number_bot || "";
async function reportCrash(status) {
  // const reportUrl = `https://example.com/api/${BOT_NUMBER}/status?status=${encodeURIComponent(status)}`;
  // try {
  //   await axios.get(reportUrl);
  //   console.log('✅ Laporan crash berhasil dikirim.');
  // } catch (err) {
  //   console.error('❌ Gagal kirim laporan crash:', err.message);
  // }
}

// ─── Error Handler ───────────────────────────────────────
process.on("uncaughtException", async (err) => {
  console.error("❌ Uncaught Exception:", err);
  await reportCrash("inactive");
  process.exit(1);
});

process.on("unhandledRejection", async (reason, promise) => {
  console.error("❌ Unhandled Rejection:", reason);
  await reportCrash("inactive");
  process.exit(1);
});
