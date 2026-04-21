import config from "../config.js";

const spam_limit = config.SPAM.limit;
const spam_cooldown = config.SPAM.couldown * 1000;
const max_warnings = config.SPAM.warning;

// Modul deteksi spam
const spamDetection = (() => {
  const senderLog = {}; // Penyimpanan sementara untuk data pengirim
  const warnings = {}; // Penyimpanan peringatan untuk pengirim

  return (sender) => {
    const now = Date.now();

    // Inisialisasi data pengirim jika belum ada
    if (!senderLog[sender]) {
      senderLog[sender] = [];
    }

    if (!warnings[sender]) {
      warnings[sender] = 0;
    }

    // Hapus entri lama berdasarkan cooldown
    senderLog[sender] = senderLog[sender].filter(
      (timestamp) => now - timestamp <= spam_cooldown
    );

    // Tambahkan entri waktu baru untuk pengirim
    senderLog[sender].push(now);

    // Deteksi spam
    if (senderLog[sender].length > spam_limit) {
      warnings[sender] += 1; // Tambahkan peringatan untuk pengirim
      senderLog[sender] = []; // Reset log pengirim

      // Jika pengirim telah melampaui batas peringatan
      if (warnings[sender] >= max_warnings) {
        return { status: "blocked", totalWarnings: warnings[sender] }; // Pengirim diblokir
      }

      return { status: "warning", totalWarnings: warnings[sender] }; // Peringatan diberikan
    }

    return { status: "safe", totalWarnings: warnings[sender] }; // Tidak ada spam terdeteksi
  };
})();

export default spamDetection;
