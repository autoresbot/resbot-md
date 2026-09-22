import mess from '../../strings.js';
import { logCustom } from '../../lib/logger.js';
import { ambilGambarMaker, ambilFotoProfil } from '../../lib/maker.js';

/** Username default dari nama WA: huruf/angka saja, huruf kecil. */
function jadiUsername(nama) {
  return String(nama || '').toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user';
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, isQuoted, prefix, command, sender, pushName } = messageInfo;

  try {
    const input = content && content.trim() !== '' ? content.trim() : (isQuoted?.text ?? '').trim();

    // Format: teks  ATAU  nama|username|teks
    let nama = pushName || 'User';
    let username = jadiUsername(pushName);
    let teks = input;

    const bagian = input.split('|').map((s) => s.trim());
    if (bagian.length >= 3) {
      nama = bagian[0] || nama;
      username = bagian[1].replace(/^@/, '') || username;
      teks = bagian.slice(2).join('|').trim();
    }

    if (!teks) {
      await sock.sendMessage(
        remoteJid,
        {
          text:
            `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${prefix + command} Halo dunia*_` +
            `\n\n_Atur nama & username sendiri:_\n_*${prefix + command} Azhari|autoresbot|Halo dunia*_` +
            `\n\n_Bisa juga dengan membalas sebuah pesan._`,
        },
        { quoted: message },
      );
      return;
    }

    await sock.sendMessage(remoteJid, { react: { text: '⏰', key: message.key } });

    const buffer = await ambilGambarMaker('/api/maker/tweet', {
      name: nama,
      username,
      text: teks,
      verified: 1,
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
  Commands: ['tweet', 'faketweet'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
