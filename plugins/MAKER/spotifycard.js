import mess from '../../strings.js';
import { logCustom } from '../../lib/logger.js';
import {
  ambilGambarMaker,
  ambilFotoProfil,
  adaGambarKiriman,
  ambilGambarKiriman,
} from '../../lib/maker.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, isQuoted, prefix, command, sender, pushName } = messageInfo;

  try {
    // Kalau yang di-reply gambar, caption gambar itu bukan input command.
    const teksDibalas = adaGambarKiriman(messageInfo) ? '' : (isQuoted?.text ?? '');
    const input = content && content.trim() !== '' ? content.trim() : teksDibalas.trim();

    // Format: judul  ATAU  judul|artis (artis default = nama WA)
    const bagian = input.split('|').map((s) => s.trim());
    const judul = bagian[0];
    const artis = bagian.slice(1).join('|').trim() || pushName || undefined;

    if (!judul) {
      await sock.sendMessage(
        remoteJid,
        {
          text:
            `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${prefix + command} Judul Lagu*_` +
            `\n\n_Atur nama artis sendiri:_\n_*${prefix + command} Judul Lagu|Nama Artis*_` +
            `\n\n_Cover: kirim / balas gambar dengan caption command ini. Tanpa gambar = foto profil kamu._`,
        },
        { quoted: message },
      );
      return;
    }

    await sock.sendMessage(remoteJid, { react: { text: '⏰', key: message.key } });

    const buffer = await ambilGambarMaker('/api/maker/spotifycard', {
      name: judul,
      subname: artis,
      // Cover: gambar yang dikirim / di-reply, kalau tidak ada foto profil pengirim.
      pp: (await ambilGambarKiriman(messageInfo, 'SPOTIFYCARD')) || (await ambilFotoProfil(sock, sender)),
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
  Commands: ['spotifycard', 'fakespotify'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
