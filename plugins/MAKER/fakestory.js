import mess from '../../strings.js';
import { logCustom } from '../../lib/logger.js';
import { ambilGambarMaker, ambilFotoProfil } from '../../lib/maker.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, isQuoted, prefix, command, sender, pushName } = messageInfo;

  try {
    const input = content && content.trim() !== '' ? content.trim() : (isQuoted?.text ?? '').trim();

    // Format: teks  ATAU  nama|teks
    let nama = pushName || 'User';
    let teks = input;

    const bagian = input.split('|').map((s) => s.trim());
    if (bagian.length >= 2) {
      nama = bagian[0] || nama;
      teks = bagian.slice(1).join('|').trim();
    }

    if (!teks) {
      await sock.sendMessage(
        remoteJid,
        {
          text:
            `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${prefix + command} Semangat pagi*_` +
            `\n\n_Atur nama sendiri:_\n_*${prefix + command} Azhari|Semangat pagi*_` +
            `\n\n_Bisa juga dengan membalas sebuah pesan._`,
        },
        { quoted: message },
      );
      return;
    }

    await sock.sendMessage(remoteJid, { react: { text: '⏰', key: message.key } });

    const buffer = await ambilGambarMaker('/api/maker/fakestory', {
      name: nama,
      text: teks,
      pp: await ambilFotoProfil(sock, sender),
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
  Commands: ['fakestory', 'fakesw'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
