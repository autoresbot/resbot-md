import { daftarRantai, MAKS_LANGKAH } from '../../lib/rantaiCommand.js';

const NAMA_JENIS = { image: 'gambar', video: 'video', sticker: 'stiker' };

function namaJenis(jenis) {
  return NAMA_JENIS[jenis] || jenis;
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, prefix } = messageInfo;

  const baris = daftarRantai()
    .map(({ aturan, commands }) => {
      const dari = aturan.terima.map(namaJenis).join('/');
      const jadi = namaJenis(aturan.hasil);
      const daftar = commands.map((c) => `${prefix}${c}`).join(', ');
      return `◧ _${dari} → ${jadi}_\n${daftar}`;
    })
    .join('\n\n');

  const teks = `*RANTAI COMMAND*

_Jalankan beberapa command sekaligus dalam satu pesan. Hasil command pertama otomatis jadi bahan command berikutnya._

_Contoh:_
_*${prefix}removebg + sticker*_
_kirim gambar → hapus background → jadi stiker_

_*${prefix}hd + removebg + sticker*_
_perjelas → hapus background → jadi stiker_

*ATURAN*
◧ _Pemisahnya *spasi + spasi*, jadi ${prefix}kalkulator 1+1 tetap aman_
◧ _Maksimal ${MAKS_LANGKAH} command per rantai_
◧ _Hanya hasil akhir yang dikirim ke chat_
◧ _Limit dipotong untuk SETIAP command dalam rantai_

*COMMAND YANG BISA DIRANTAI*

${baris}`;

  await sock.sendMessage(remoteJid, { text: teks }, { quoted: message });
}

export default {
  handle,
  Commands: ['rantai', 'multicommand'],
  OnlyPremium: false,
  OnlyOwner: false,
};
