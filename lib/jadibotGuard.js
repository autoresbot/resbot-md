/**
 * jadibotGuard.js - Pengawas masa aktif jadibot.
 *
 * `.jadibot <nomor> <hari>` menyimpan `expired_at` (lihat lib/jadibot.js).
 * Pengawas ini berjalan berkala: begitu masa aktif sebuah jadibot habis,
 * sesinya ditutup otomatis (seperti `.stopjadibot`) supaya tidak terus hidup.
 *
 * Catatan: folder sesi TIDAK dihapus, hanya di-stop — sama seperti .stopjadibot,
 * sehingga owner masih bisa menyalakannya lagi dengan .jadibot bila mau.
 */
import { sessions } from './cache.js';
import { getExpiredJadibot, updateJadibot } from './jadibot.js';
import { logWithTime } from './utils.js';

/** Hentikan satu jadibot yang masa aktifnya habis. */
async function hentikanJadibot(number) {
  try {
    const sockSesi = sessions.get(`session/${number}`);
    if (sockSesi) {
      try {
        await sockSesi.ws?.close?.();
      } catch {
        // socket mungkin sudah tertutup — abaikan
      }
      sessions.delete(`session/${number}`);
    }
    await updateJadibot(number, 'stop');
    logWithTime('Jadibot', `Masa aktif ${number} habis — dihentikan otomatis`, 'merah');
  } catch (error) {
    console.warn(`[JADIBOT] Gagal menghentikan ${number}: ${error?.message || error}`);
  }
}

async function periksaKedaluwarsa() {
  let kadaluarsa = [];
  try {
    kadaluarsa = getExpiredJadibot();
  } catch (error) {
    console.warn(`[JADIBOT] Gagal membaca daftar kedaluwarsa: ${error?.message || error}`);
    return;
  }
  for (const number of kadaluarsa) {
    await hentikanJadibot(number);
  }
}

/** Jarak antar pengecekan: cukup 5 menit, tidak perlu real-time. */
const INTERVAL_MS = 5 * 60 * 1000;

/** Dipanggil sekali saat bot mulai. */
function mulaiPengawasJadibot() {
  // Cek sekali di awal (menangani yang sudah telanjur lewat saat bot mati).
  periksaKedaluwarsa();
  setInterval(periksaKedaluwarsa, INTERVAL_MS).unref?.();
}

export { mulaiPengawasJadibot, periksaKedaluwarsa };
