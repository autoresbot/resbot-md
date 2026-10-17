import mess from '../../strings.js';
import { logCustom } from '../../lib/logger.js';
import { ambilGambarMaker } from '../../lib/maker.js';

// Command -> endpoint. OVO tidak memakai nama, hanya nominal.
const JENIS = {
  fakedana: { endpoint: '/api/maker/fakedana', pakaiNama: true },
  fakebca: { endpoint: '/api/maker/fakebca', pakaiNama: true },
  fakeovo: { endpoint: '/api/maker/fakeovo', pakaiNama: false },
};

// Nominal yang sah: angka dengan pemisah titik/koma/spasi, boleh diawali "Rp".
// Teks campuran seperti "budi123" ditolak, supaya angka di dalam nama tidak
// terbaca sebagai nominal.
const POLA_NOMINAL = /^(?:rp\.?\s*)?\d[\d.,\s]*$/i;

/** "10.000" / "Rp 10,000" -> "10000". Kosong kalau bukan format uang. */
function ambilNominal(teks) {
  const bersih = String(teks || '').trim();
  return POLA_NOMINAL.test(bersih) ? bersih.replace(/\D/g, '') : '';
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, isQuoted, prefix, command, pushName } = messageInfo;
  const jenis = JENIS[command];

  try {
    const input = content && content.trim() !== '' ? content.trim() : (isQuoted?.text ?? '').trim();

    // Format DANA/BCA: nama|nominal  ATAU  nominal (nama = nama WA)
    // Format OVO     : nominal
    let nama = pushName || 'User';
    let nominal;

    const bagian = input.split('|').map((s) => s.trim());
    if (jenis.pakaiNama && bagian.length >= 2) {
      nama = bagian[0] || nama;
      nominal = ambilNominal(bagian[1]);
    } else {
      nominal = ambilNominal(bagian[0]);
    }

    if (!nominal) {
      const contoh = jenis.pakaiNama
        ? `_💬 Contoh:_ _*${prefix + command} resbot|50000*_` +
          `\n\n_Tanpa nama = pakai nama WA kamu:_\n_*${prefix + command} 50000*_`
        : `_💬 Contoh:_ _*${prefix + command} 50000*_`;

      await sock.sendMessage(
        remoteJid,
        { text: `_⚠️ Format Penggunaan:_ \n\n${contoh}` },
        { quoted: message },
      );
      return;
    }

    await sock.sendMessage(remoteJid, { react: { text: '⏰', key: message.key } });

    const buffer = await ambilGambarMaker(jenis.endpoint, {
      name: jenis.pakaiNama ? nama : undefined,
      nominal,
    });

    await sock.sendMessage(
      remoteJid,
      { image: buffer, caption: mess.general.success },
      { quoted: message },
    );
  } catch (error) {
    console.error('Kesalahan di fungsi handle:', error);
    logCustom('info', content, `ERROR-COMMAND-${command}.txt`);

    await sock.sendMessage(
      remoteJid,
      { text: `_Error: ${error.message || 'Terjadi kesalahan tak dikenal.'}_` },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: Object.keys(JENIS),
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
