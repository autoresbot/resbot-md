import { accGroups, isAccGroup } from '../../lib/accGroups.js';
import { groupFetchAllParticipating } from '../../lib/cache.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message, senderLid, prefix, command } = messageInfo;

  try {
    const semuaGrup = (await groupFetchAllParticipating(sock)) || {};
    const idGrup = Object.keys(semuaGrup);

    if (idGrup.length === 0) {
      await sock.sendMessage(
        remoteJid,
        { text: '⚠️ _Bot belum berada di grup mana pun._' },
        { quoted: message },
      );
      return;
    }

    const sudahAktif = idGrup.filter((id) => isAccGroup(id)).length;
    const baru = accGroups(idGrup, senderLid);

    await sock.sendMessage(
      remoteJid,
      {
        text:
          `✅ _Semua grup berhasil diaktifkan._\n\n` +
          `│ Grup diikuti bot : *${idGrup.length}*\n` +
          `│ Baru diaktifkan : *${baru}*\n` +
          `│ Sudah aktif sebelumnya : *${sudahAktif}*\n\n` +
          `_Lihat daftar: *${prefix}listacc*_`,
      },
      { quoted: message },
    );
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
  Commands: ['accall'],
  OnlyPremium: false,
  OnlyOwner: true,
};
