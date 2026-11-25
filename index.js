/*
⚠️ PERINGATAN:
Script ini **TIDAK BOLEH DIPERJUALBELIKAN** dalam bentuk apa pun!

╔══════════════════════════════════════════════╗
║                🛠️ INFORMASI SCRIPT           ║
╠══════════════════════════════════════════════╣
║ 📦 Version   : 5.5.0
║ 👨‍💻 Developer  : Azhari Creative              ║
║ 🌐 Website    : https://autoresbot.com       ║
║ 💻 GitHub  : github.com/autoresbot/resbot-md ║
╚══════════════════════════════════════════════╝

📌 Script ini Open Source dan gratis.
*/
// ─── Setelan jaringan (IPv4 dulu, Happy Eyeballs 2 detik) ───
// HARUS import pertama: dievaluasi sebelum modul lain sempat membuka koneksi.
import './lib/netBootstrap.js';

// ─── Import modul internal via path relatif ───────────
import './lib/version.js';
import { checkAndInstallModules, clearDirectory, warning } from './lib/utils.js';

console.log(`[✔] Start App ...`);

// ─── Cek versi Node ───────────────────────────────
const [major] = process.versions.node.split('.').map(Number);

if (major < 20) {
  console.error(`❌ Script ini hanya kompatibel Minimal Node.js versi 20.x`);
  console.error(
    `ℹ️ Jika kamu menjalankan script ini melalui panel, buka menu *Startup*, lalu ubah *Docker Image* ke versi Node.js 20`,
  );

  // Tunggu 1 menit lalu exit
  setTimeout(() => process.exit(1), 60_000);
} else {
  process.env.TZ = 'Asia/Jakarta'; // Timezone utama

  const config = (await import('./config.js')).default;

  const BOT_NUMBER = config.phone_number_bot || '';

  // ─── Auto-update library zapo-js ──────────────────────────────────────────
  // Setel `true` agar bot otomatis memperbarui zapo-js (+ @zapo-js/store-sqlite)
  // ke versi terbaru setiap start, dengan ROLLBACK otomatis bila update membuat
  // bot gagal terhubung (lihat lib/zapoUpdater.js). Setel `false` untuk mematikan
  // (versi dikunci sesuai package.json). Setelan ini SENGAJA di sini, bukan di
  // config.js.
  const AUTO_UPDATE_ZAPO = true;

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

  // ─── Error Handler ───────────────────────────────
  // FIX: error logger global - simpan crash global ke logs/error.log
  // Didaftarkan SEBELUM start_app(): proses startup (koneksi WhatsApp, load
  // plugin, migrasi database) juga bisa melempar unhandledRejection /
  // uncaughtException, dan sebelumnya error di tahap itu hilang tanpa jejak
  // karena handler baru dipasang setelah start_app() selesai.
  const { logError } = await import('./lib/errorLogger.js');

  process.on('uncaughtException', (err) => {
    console.log('========== UNCAUGHT EXCEPTION ==========');
    console.log('Message:', err?.message);
    console.log('Code:', err?.code);
    console.log('Stack:', err?.stack);
    console.log('=========================================');
    logError(err, { plugin: 'process', command: 'uncaughtException' });
  });

  process.on('unhandledRejection', (err) => {
    console.log('========== UNHANDLED REJECTION ==========');
    console.log('Message:', err?.message);
    console.log('Code:', err?.code);
    console.log('Stack:', err?.stack);
    console.log('=========================================');
    logError(err, { plugin: 'process', command: 'unhandledRejection' });
    import('./lib/diskGuard.js').then(({ tanganiErrorDisk }) => tanganiErrorDisk(err)).catch(() => {});
  });

  // ─── Start App ───────────────────────────────────
  try {
    clearDirectory('./tmp');

    // Folder sementara dialihkan dari /tmp panel yang sempit (lihat lib/diskGuard.js)
    const { mulaiPenjagaDisk } = await import('./lib/diskGuard.js');
    mulaiPenjagaDisk();

    // Pengawas masa aktif jadibot: stop otomatis saat durasi (.jadibot <nomor>
    // <hari>) habis.
    const { mulaiPengawasJadibot } = await import('./lib/jadibotGuard.js');
    mulaiPengawasJadibot();

    // Jalankan setiap 3 jam (3 jam = 10800000 ms)
    setInterval(
      () => {
        // Pembersihan tmp berkala tetap jalan tanpa log (dulu mengganggu konsol).
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

    // Module dashboard dicek terpisah: kalau gagal diinstal, bot tetap jalan
    // (dashboard saja yang dilewati).
    try {
      await checkAndInstallModules(['express@^5.1.0']);
    } catch (error) {
      warning('Dashboard', `Gagal menginstal express: ${error.message}`);
    }

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

    // Jaga zapo-js selalu terbaru. WAJIB sebelum start_app(): koneksi WhatsApp
    // baru membuka (dan meng-import) zapo-js di dalam start_app, jadi versi baru
    // ikut terpakai. Rollback otomatis ditangani di dalam sinkronkanZapo.
    try {
      const { sinkronkanZapo } = await import('./lib/zapoUpdater.js');
      await sinkronkanZapo({ autoUpdate: AUTO_UPDATE_ZAPO });
    } catch (error) {
      warning('Zapo', `Auto-update dilewati: ${error?.message || error}`);
    }

    const { start_app } = await import('./lib/startup.js');
    await start_app();

    // Setelah bot mencoba konek: verifikasi update zapo-js (hapus penanda bila
    // koneksi berhasil; bila tidak, rollback dilakukan saat restart berikutnya).
    try {
      const { pantauVerifikasiZapo } = await import('./lib/zapoUpdater.js');
      pantauVerifikasiZapo();
    } catch {
      // abaikan — verifikasi hanya penyempurnaan
    }

    // Dashboard web dijalankan paling akhir (menunggu bot terhubung) dan
    // terpisah dari bot: kegagalan apa pun di sini tidak menghentikan bot.
    import('./dashboard/index.js')
      .then(({ startDashboard }) => startDashboard())
      .catch((err) => warning('Dashboard', `Tidak dijalankan: ${err.message}`));
  } catch (err) {
    console.error('Error dalam proses start_app:', err.message);
    logError(err, { plugin: 'process', command: 'start_app' });
    await reportCrash('inactive');
    process.exit(1);
  }

  // ─── Graceful Shutdown: pastikan database di-close saat restart/stop ───
  const gracefulShutdown = async (signal) => {
    console.log(`[⚠] ${signal} received. Closing database...`);
    try {
      const { closeDatabase } = await import('./lib/database.js');
      closeDatabase();
    } catch (e) {
      // ignore
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}
