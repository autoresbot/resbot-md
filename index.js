/*
⚠️ PERINGATAN:
Script ini **TIDAK BOLEH DIPERJUALBELIKAN** dalam bentuk apa pun!

╔══════════════════════════════════════════════╗
║                🛠️ INFORMASI SCRIPT           ║
╠══════════════════════════════════════════════╣
║ 📦 Version   : 5.2.3
║ 👨‍💻 Developer  : Azhari Creative              ║
║ 🌐 Website    : https://autoresbot.com       ║
║ 💻 GitHub  : github.com/autoresbot/resbot-md ║
╚══════════════════════════════════════════════╝

📌 Script ini Open Source dan gratis.
*/
// ─── Import modul internal via path relatif ───────────
import './lib/version.js';
import { checkAndInstallModules, clearDirectory } from './lib/utils.js';

console.log(`[✔] Start App ...`);

// ─── Cek versi Node ───────────────────────────────
const [major] = process.versions.node.split('.').map(Number);

if (major < 20 || major >= 21) {
  console.error(`❌ Script ini hanya kompatibel dengan Node.js versi 20.x`);
  console.error(
    `ℹ️ Jika kamu menjalankan script ini melalui panel, buka menu *Startup*, lalu ubah *Docker Image* ke versi Node.js 20`,
  );

  // Tunggu 1 menit lalu exit
  setTimeout(() => process.exit(1), 60_000);
} else {
  process.env.TZ = 'Asia/Jakarta'; // Timezone utama

  const config = (await import('./config.js')).default;

  const BOT_NUMBER = config.phone_number_bot || '';

  // ─── Fungsi report crash ─────────────────────────
  async function reportCrash(status) {
    // Laporan crash bisa diaktifkan nanti
    // const axios = (await import('axios')).default;
    // const reportUrl = `https://example.com/api/${BOT_NUMBER}/status?status=${encodeURIComponent(status)}`;
    // try {
    //   await axios.get(reportUrl);
    //   console.log('✅ Laporan crash berhasil dikirim.');
    // } catch (err) {
    //   console.error('❌ Gagal kirim laporan crash:', err.message);
    // }
  }

  // ─── Start App ───────────────────────────────────
  try {
    clearDirectory('./tmp');

    // Jalankan setiap 3 jam (3 jam = 10800000 ms)
    setInterval(
      () => {
        console.log('[SCHEDULE] Membersihkan folder tmp...');
        clearDirectory('./tmp');
      },
      3 * 60 * 60 * 1000,
    );

    console.log('[✔] Cache cleaned successfully.');

    await checkAndInstallModules([
      'follow-redirects',
      'jimp@1.6.0',
      'qrcode-reader',
      'wa-sticker-formatter',
      'api-autoresbot@1.0.6',
      'extract-zip',
    ]);

    try {
      const { applyUpdateIfExists } = await import('./plugins/OWNER/update.js');

      await applyUpdateIfExists();
    } catch (error) {
      console.log('Error Apply Update');
    }

    // Inisialisasi SQLite dan jalankan migrasi jika diperlukan
    const { initDatabase } = await import('./lib/database.js');
    initDatabase();
    console.log('[✔] SQLite database ready.');

    const { start_app } = await import('./lib/startup.js');
    await start_app();
  } catch (err) {
    console.error('Error dalam proses start_app:', err.message);
    await reportCrash('inactive');
    process.exit(1);
  }

  // ─── Error Handler ───────────────────────────────
  process.on('uncaughtException', (err) => {
    console.log('========== UNCAUGHT EXCEPTION ==========');
    console.log('Message:', err?.message);
    console.log('Code:', err?.code);
    console.log('Stack:', err?.stack);
    console.log('=========================================');
  });

  process.on('unhandledRejection', (err) => {
    console.log('========== UNHANDLED REJECTION ==========');
    console.log('Message:', err?.message);
    console.log('Code:', err?.code);
    console.log('Stack:', err?.stack);
    console.log('=========================================');
  });
}
