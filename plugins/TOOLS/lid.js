import { hasOwner } from '../../lib/users.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message, sender, senderLid } = messageInfo;

  try {
    const id = senderLid || '-';

    // Instalasi baru (DATA_OWNER masih kosong): sekalian tunjukkan cara
    // memakai ID ini, karena .id memang dibuka untuk itu (lihat autoresbot.js).
    const text = hasOwner()
      ? id
      : `${id}\n\n_⚠️ DATA_OWNER masih kosong._\n\n_Salin ID di atas ke *DATA_OWNER* pada config.js (atau menu Config di dashboard), lalu restart bot._\n\n_Contoh:_\n_DATA_OWNER = ['${id}'];_\n\n_Setelah itu ketik *.acc* di grup untuk mengaktifkan bot._`;

    await sock.sendMessage(remoteJid, { text }, { quoted: message });
  } catch (error) {
    console.error('[LID ERROR]', error);

    await sock.sendMessage(remoteJid, { text: 'Maaf, terjadi kesalahan' }, { quoted: message });
  }
}

export default {
  handle,
  Commands: ['id'],
  OnlyPremium: false,
  OnlyOwner: false,
};
