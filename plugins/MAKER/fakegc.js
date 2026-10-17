import mess from '../../strings.js';
import { logCustom } from '../../lib/logger.js';
import {
  ambilGambarMaker,
  ambilFotoProfil,
  adaGambarKiriman,
  ambilGambarKiriman,
} from '../../lib/maker.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, isQuoted, prefix, command, sender } = messageInfo;

  try {
    // Kalau yang di-reply gambar, caption gambar itu bukan input command.
    const teksDibalas = adaGambarKiriman(messageInfo) ? '' : (isQuoted?.text ?? '');
    const input = content && content.trim() !== '' ? content.trim() : teksDibalas.trim();

    // Format: nama | member. Keduanya wajib diisi.
    const bagian = input.split('|').map((s) => s.trim());
    const nama = bagian[0] || '';
    const memberRaw = bagian[1] || '';
    const member = memberRaw.replace(/\D/g, '');

    if (!nama || !member) {
      let alasan;
      if (!nama) alasan = 'Nama grup tidak boleh kosong.';
      else if (!memberRaw) alasan = 'Jumlah member tidak boleh kosong.';
      else alasan = 'Jumlah member harus berupa angka.';

      await sock.sendMessage(
        remoteJid,
        {
          text:
            `_⚠️ ${alasan}_\n\n` +
            `_Format:_ *${prefix + command} nama grup | jumlah member*` +
            `\n\n_💬 Contoh:_\n_*${prefix + command} Resbot Official | 1024*_` +
            `\n\n_Foto grup bisa diganti: kirim / balas gambar dengan caption command ini._`,
        },
        { quoted: message },
      );
      return;
    }

    await sock.sendMessage(remoteJid, { react: { text: '⏰', key: message.key } });

    // Urutan foto: gambar yang dikirim / di-reply, lalu foto grup (kalau di
    // grup), lalu foto profil pengirim.
    const diGrup = remoteJid.endsWith('@g.us');
    const pp =
      (await ambilGambarKiriman(messageInfo, 'FAKEGC')) ||
      (diGrup && (await ambilFotoProfil(sock, remoteJid))) ||
      (await ambilFotoProfil(sock, sender));

    const buffer = await ambilGambarMaker('/api/maker/fakegc', { name: nama, member, pp });

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
  Commands: ['fakegc', 'fakegrup'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
