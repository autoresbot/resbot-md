import config from "../config.js";

const max_warnings = config.BADWORD.warning;

const badwordDetection = (() => {
  const senderLog = {}; // Penyimpanan sementara untuk data pengirim
  const warnings = {}; // Penyimpanan peringatan untuk pengirim

  return (sender) => {
    if (!senderLog[sender]) {
      senderLog[sender] = [];
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
    return { status: "warning", totalWarnings: warnings[sender] }; // Peringatan diberikan
  };
})();

export default badwordDetection;
