import axios from 'axios';

const TIMEOUT_MS = 10000;

/** Terjemahkan kegagalan jaringan jadi kalimat yang bisa ditindaklanjuti. */
function jelaskanError(error, target) {
  if (error.response) {
    return `Server *${target}* membalas HTTP ${error.response.status}`;
  }

  const kode = error.code || '';
  const pesan = {
    ECONNABORTED: `Tidak ada balasan dalam ${TIMEOUT_MS / 1000} detik (timeout)`,
    ETIMEDOUT: `Tidak ada balasan dalam ${TIMEOUT_MS / 1000} detik (timeout)`,
    ENOTFOUND: `Alamat *${target}* tidak ditemukan (DNS gagal / domain salah)`,
    EAI_AGAIN: 'DNS server tidak merespons — biasanya masalah jaringan panel',
    ECONNREFUSED: `Koneksi ke *${target}* ditolak`,
    ECONNRESET: 'Koneksi terputus di tengah jalan',
    CERT_HAS_EXPIRED: 'Sertifikat SSL situs tujuan sudah kedaluwarsa',
  }[kode];

  return pesan || `${kode ? `${kode}: ` : ''}${error.message}`;
}

/** Detik dengan 6 angka di belakang koma, sesuai format balasan. */
function detik(mulai) {
  return (Number(process.hrtime.bigint() - mulai) / 1e9).toFixed(6);
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, content } = messageInfo;
  const mulai = process.hrtime.bigint();

  try {
    // ── Tanpa isi: kecepatan bot sendiri ─────────────────────────────────
    if (!content) {
      await sock.sendMessage(
        remoteJid,
        { text: `⌬ Response Time : ${detik(mulai)} s` },
        { quoted: message },
      );
      return;
    }

    // ── Dengan isi: ping ke alamat yang diminta ──────────────────────────
    const isi = content.trim().split(/\s+/)[0];
    const target = /^https?:\/\//i.test(isi) ? isi : `https://${isi}`;

    await axios.get(target, {
      timeout: TIMEOUT_MS,
      // Sebagian situs menolak permintaan tanpa User-Agent.
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ResbotMD/1.0)' },
      // 4xx/5xx tetap dianggap "nyambung" — yang diukur kecepatannya.
      validateStatus: () => true,
      maxRedirects: 3,
    });

    await sock.sendMessage(
      remoteJid,
      { text: `⌬ Response Time : ${detik(mulai)} s\n⌬ Ping : ${target}` },
      { quoted: message },
    );
  } catch (error) {
    console.error('Error in ping handler:', error?.message || error);

    const isi = (content || '').trim().split(/\s+/)[0];
    const target = /^https?:\/\//i.test(isi) ? isi : `https://${isi}`;

    await sock.sendMessage(
      remoteJid,
      { text: `⚠️ _Ping gagal._\n\n⌬ _Target :_ ${target}\n⌬ _Alasan :_ ${jelaskanError(error, target)}` },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['ping'],
  OnlyPremium: false,
  OnlyOwner: false,
};
