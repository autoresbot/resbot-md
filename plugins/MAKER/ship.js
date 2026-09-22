import mess from '../../strings.js';
import { logCustom } from '../../lib/logger.js';
import { ambilGambarMaker } from '../../lib/maker.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;

  try {
    // Format: nama1|nama2
    const [nama1, nama2] = (content || '').split('|').map((s) => s.trim());

    if (!nama1 || !nama2) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${prefix + command} Budi|Siti*_`,
        },
        { quoted: message },
      );
      return;
    }

    await sock.sendMessage(remoteJid, { react: { text: '⏰', key: message.key } });

    // Tanpa `percent` API menghitung nilai dari nama, jadi pasangan yang sama
    // selalu dapat angka yang sama. Diacak 1-100 supaya tiap .ship berbeda.
    const persen = Math.floor(Math.random() * 100) + 1;

    const buffer = await ambilGambarMaker('/api/maker/ship', {
      name1: nama1,
      name2: nama2,
      percent: persen,
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
  Commands: ['ship'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
