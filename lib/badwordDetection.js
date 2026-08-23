import config from "../config.js";

const max_warnings = config.BADWORD.warning;

const WARNING_EXPIRY = 60 * 60 * 1000;

const badwordDetection = (() => {
  const senderLog = {}; // Penyimpanan sementara untuk data pengirim
  const warnings = {}; // Penyimpanan peringatan untuk pengirim
  const lastWarningAt = {};

  return (sender) => {
    const now = Date.now();

    if (!senderLog[sender]) {
      senderLog[sender] = [];
    }

    if (lastWarningAt[sender] && now - lastWarningAt[sender] > WARNING_EXPIRY) {
      warnings[sender] = 0;
      lastWarningAt[sender] = 0;
    }

    if (!warnings[sender]) {
      warnings[sender] = 0;
    }

    // Jika pengirim telah melampaui batas peringatan
    if (warnings[sender] >= max_warnings) {
      return { status: "blocked", totalWarnings: warnings[sender] }; // Pengirim diblokir
    }

    // Tambahkan peringatan untuk pengirim
    warnings[sender]++;
    lastWarningAt[sender] = now;
    return { status: "warning", totalWarnings: warnings[sender] }; // Peringatan diberikan
  };
})();

export default badwordDetection;
