import { listAccGroups, isAccGroup } from '../../lib/accGroups.js';
import { simpanPilihan } from '../../lib/accPilihan.js';
import { groupFetchAllParticipating } from '../../lib/cache.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message, senderLid, prefix, command } = messageInfo;

  try {
    // Semua grup yang diikuti bot (untuk dilihat mana yang belum aktif)
    const semuaGrup = (await groupFetchAllParticipating(sock)) || {};
    const tercatat = listAccGroups();

    // Grup yang di-.acc tapi bot sudah tidak ada di dalamnya tetap ditampilkan
    // supaya bisa dibersihkan dengan .unacc.
    const idGrup = [...new Set([...Object.keys(semuaGrup), ...tercatat.map((g) => g.id)])];

    if (idGrup.length === 0) {
      await sock.sendMessage(
        remoteJid,
        { text: '⚠️ _Bot belum berada di grup mana pun._' },
        { quoted: message },
      );
      return;
    }

    const sumber = new Map(tercatat.map((g) => [g.id, g.added_by]));

    // Aktif ditaruh di atas, lalu urut nama supaya mudah dicari
    const urut = idGrup.sort((a, b) => {
      const beda = Number(isAccGroup(b)) - Number(isAccGroup(a));
      if (beda !== 0) return beda;
      return (semuaGrup[a]?.subject || '').localeCompare(semuaGrup[b]?.subject || '');
    });

    // Nomor urut disimpan supaya owner bisa mengetik `.acc 3`
    simpanPilihan(senderLid, urut);

    let teks = '*▧ 「 LIST GRUP 」*\n\n';
    urut.forEach((id, index) => {
      const aktif = isAccGroup(id);
      const grup = semuaGrup[id];
      const nama = grup?.subject || (aktif ? 'Bot tidak ada di grup ini' : 'Nama tidak diketahui');
      const via = sumber.get(id) === 'sewa' ? ' (sewa)' : '';

      teks += `╭─ *${index + 1}.* ${aktif ? '✅ AKTIF' : '❌ BELUM'}${via}
│ Nama : ${nama}
│ ID : ${id}
╰────────────────────────\n`;
    });

    const totalAktif = urut.filter((id) => isAccGroup(id)).length;
    teks += `\n*Aktif : ${totalAktif} dari ${urut.length} grup*\n\n`;
    teks += `_Aktifkan:_ *${prefix}acc <nomor / id>*\n_Nonaktifkan:_ *${prefix}unacc <nomor / id>*\n\n_Contoh:_ *${prefix}acc 1*`;

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
  Commands: ['listacc'],
  OnlyPremium: false,
  OnlyOwner: true,
};
