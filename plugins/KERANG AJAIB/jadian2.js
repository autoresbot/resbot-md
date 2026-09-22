import mess from '../../strings.js';
import { getGroupMetadata } from '../../lib/cache.js';
import { logCustom } from '../../lib/logger.js';
import { ambilGambarMaker, ambilFotoProfil } from '../../lib/maker.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message, isGroup, sender, senderLid, pushName, command } = messageInfo;

  if (!isGroup) {
    return sock.sendMessage(remoteJid, { text: mess.game.isGroup }, { quoted: message });
  }

  try {
    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    if (!groupMetadata?.participants) {
      await sock.sendMessage(
        remoteJid,
        { text: '⚠️ Gagal mengambil data grup, coba lagi beberapa saat.' },
        { quoted: message },
      );
      return;
    }

    // Pilih anggota acak selain pengirim
    const kandidat = groupMetadata.participants.filter(
      (p) => ![sender, senderLid].includes(p.id) && ![sender, senderLid].includes(p.phoneNumber),
    );
    if (kandidat.length === 0) {
      await sock.sendMessage(
        remoteJid,
        { text: '⚠️ Belum ada anggota lain di grup ini untuk dijodohkan.' },
        { quoted: message },
      );
      return;
    }

    const pasangan = kandidat[Math.floor(Math.random() * kandidat.length)];
    const targetJid = pasangan.phoneNumber || pasangan.id;
    const nomorPengirim = sender.split('@')[0];
    const nomorTarget = targetJid.split('@')[0];

    await sock.sendMessage(remoteJid, { react: { text: '⏰', key: message.key } });

    const persen = Math.floor(Math.random() * 100) + 1;
    const [pp1, pp2] = await Promise.all([
      ambilFotoProfil(sock, sender),
      ambilFotoProfil(sock, targetJid),
    ]);

    const buffer = await ambilGambarMaker('/api/maker/ship', {
      name1: pushName || nomorPengirim,
      name2: nomorTarget,
      percent: persen,
      pp1,
      pp2,
    });

    await sock.sendMessage(
      remoteJid,
      {
        image: buffer,
        // Komentar sesuai nilai sudah tercetak di gambar oleh API.
        caption: `@${nomorPengirim} ❤️ @${nomorTarget}\n\nKecocokan: *${persen}%*`,
        mentions: [sender, targetJid],
      },
      { quoted: message },
    );
  } catch (error) {
    console.error('Kesalahan di fungsi handle:', error);
    logCustom('info', '', `ERROR-COMMAND-${command}.txt`);

    await sock.sendMessage(
      remoteJid,
      { text: `_Error: ${error.message || 'Terjadi kesalahan tak dikenal.'}_` },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['jadian2'],
  OnlyPremium: false,
  OnlyOwner: false,
};
