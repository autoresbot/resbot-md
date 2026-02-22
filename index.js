/*
⚠️ PERINGATAN:
Script ini **TIDAK BOLEH DIPERJUALBELIKAN** dalam bentuk apa pun!

╔══════════════════════════════════════════════╗
║                🛠️ INFORMASI SCRIPT           ║
╠══════════════════════════════════════════════╣
║ 📦 Version   : 5.1.0
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
    ]);

    const { start_app } = await import('./lib/startup.js');
    await start_app();
  } catch (err) {
    console.error('Error dalam proses start_app:', err.message);
    await reportCrash('inactive');
    process.exit(1);
  }

  // ─── Error Handler ───────────────────────────────
  process.on('uncaughtException', (err) => {
    if (err?.code === 'UND_ERR_SOCKET' || err?.message?.includes('terminated')) {
      console.log('Socket HTTP closed safely.');
      return;
    }
    console.error('❌ Uncaught Exception:', err);
  });

  process.on('unhandledRejection', (err) => {
    if (err?.code === 'UND_ERR_SOCKET' || err?.message?.includes('terminated')) {
      console.log('HTTP request aborted.');
      return;
    }
    console.error('❌ Unhandled Rejection:', err);
  });
}
