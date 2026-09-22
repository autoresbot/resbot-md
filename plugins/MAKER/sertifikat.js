import mess from '../../strings.js';
import { logCustom } from '../../lib/logger.js';
import { ambilGambarMaker } from '../../lib/maker.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command, pushName } = messageInfo;

  try {
    // Format: nama|gelar  ATAU  gelar saja (nama diambil dari nama WA)
    const input = (content || '').trim();
    const bagian = input.split('|').map((s) => s.trim());

    let nama = pushName || '';
    let gelar = input;
    if (bagian.length >= 2) {
      nama = bagian[0];
      gelar = bagian.slice(1).join('|').trim();
    }

    if (!nama || !gelar) {
      await sock.sendMessage(
        remoteJid,
        {
          text:
            `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${prefix + command} Azhari|Member Teladan*_` +
            `\n\n_Tanpa nama, dipakai nama WhatsApp kamu:_\n_*${prefix + command} Member Teladan*_`,
        },
        { quoted: message },
      );
      return;
    }

    await sock.sendMessage(remoteJid, { react: { text: '⏰', key: message.key } });

    const buffer = await ambilGambarMaker('/api/maker/sertifikat', { name: nama, title: gelar });

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
  Commands: ['sertifikat', 'certificate'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
