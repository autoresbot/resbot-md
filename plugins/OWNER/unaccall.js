import { unaccAll } from '../../lib/accGroups.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;

  try {
    // Grup sewa dilewati, kecuali owner menegaskan dengan ".unaccall sewa"
    const ikutSewa = (content || '').trim().toLowerCase() === 'sewa';
    const { dimatikan, sewaDilewati } = unaccAll({ ikutSewa });

    if (dimatikan === 0 && sewaDilewati === 0) {
      await sock.sendMessage(
        remoteJid,
        { text: '⚠️ _Tidak ada grup yang aktif._' },
        { quoted: message },
      );
      return;
    }

    let teks = `✅ _*${dimatikan}* grup dinonaktifkan._\n\n_Bot tidak akan merespons siapa pun di grup itu kecuali owner._`;

    if (sewaDilewati > 0) {
      teks +=
        `\n\n_⚠️ *${sewaDilewati}* grup sewa sengaja dilewati supaya layanan pelanggan tidak ikut mati._\n\n` +
        `_Kalau memang ingin ikut dimatikan, ketik:_ *${prefix}${command} sewa*`;
    }

    await sock.sendMessage(remoteJid, { text: teks }, { quoted: message });
  } catch (error) {
    console.error(`Kesalahan di ${command}:`, error);
    await sock.sendMessage(
      remoteJid,
      { text: `_Error: ${error.message || 'Terjadi kesalahan tak dikenal.'}_` },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['unaccall'],
  OnlyPremium: false,
  OnlyOwner: true,
};
