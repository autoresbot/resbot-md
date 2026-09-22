import {
  setLeft,
  setTemplateLeft,
  setLeftMedia,
  checkMessage,
} from '../../lib/participants.js';
import { getGroupMetadata, pesertaAdalahAdmin } from '../../lib/cache.js';
import { isOwner } from '../../lib/users.js';
import { deleteMedia } from '../../lib/utils.js';
import { deteksiMediaSapaan, simpanMediaSapaan, labelMedia } from '../../lib/sapaanMedia.js';
import mess from '../../strings.js';

/** Mode tampilan pesan perpisahan. Angka = jalan pintas. */
const MODE = {
  text: 'text',
  1: 'text',
  template: 'template',
  2: 'template',
  foto: 'foto',
  gambar: 'foto',
  image: 'foto',
  3: 'foto',
  video: 'video',
  gif: 'video',
  4: 'video',
};

function pesanBantuan(prefix, command) {
  return (
    `_⚠️ Format Penggunaan:_\n\n` +
    `_*${prefix}${command} <teks perpisahan>*_ _(balas foto/video/stiker → otomatis dipakai)_\n` +
    `_*${prefix}${command} text <teks perpisahan>*_\n` +
    `_*${prefix}${command} template <teks perpisahan>*_\n\n` +
    `_💬 Contoh:_\n` +
    `_*${prefix}${command} text Selamat tinggal @name*_\n` +
    `_*${prefix}${command} template Sampai jumpa @name*_\n` +
    `_*${prefix}${command} Selamat jalan @name*_ _(sambil membalas foto/video)_\n\n` +
    `_*List Variable*_${global.group.variable}\n\n` +
    `_Lihat hasilnya: *${prefix}tesleft*_`
  );
}

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, content, sender, senderLid, command, prefix, isQuoted } =
    messageInfo;
  if (!isGroup) return; // Only Grub

  const groupMetadata = await getGroupMetadata(sock, remoteJid);
  if (!groupMetadata?.participants) {
    await sock.sendMessage(
      remoteJid,
      { text: '⚠️ _Gagal mengambil data grup, coba lagi beberapa saat._' },
      { quoted: message },
    );
    return;
  }

  // Pola lama (p.id === sender) selalu meleset di grup ber-alamat LID.
  const isAdmin =
    pesertaAdalahAdmin(groupMetadata.participants, sender, senderLid) || isOwner(senderLid);

  if (!isAdmin) {
    await sock.sendMessage(remoteJid, { text: mess.general.isAdmin }, { quoted: message });
    return;
  }

  const isi = (content || '').trim();
  const mediaPesan = deteksiMediaSapaan(messageInfo);

  if (!isi && !mediaPesan) {
    await sock.sendMessage(remoteJid, { text: pesanBantuan(prefix, command) }, { quoted: message });
    return;
  }

  const [kataPertama, ...sisa] = isi ? isi.split(/\s+/) : [''];
  const mode = MODE[kataPertama.toLowerCase()];

  const balas = async (keterangan, teksBaru) => {
    if (teksBaru) await setLeft(remoteJid, teksBaru);
    let teksAkhir = teksBaru || (await checkMessage(remoteJid, 'remove')) || '';

    // Belum pernah mengisi teks -> simpan teks bawaan sekalian, supaya pesan
    // perpisahannya pasti terkirim (bukan diam) saat ada yang keluar.
    if (!teksAkhir) {
      teksAkhir = 'Selamat tinggal @name';
      await setLeft(remoteJid, teksAkhir);
    }

    await sock.sendMessage(
      remoteJid,
      {
        text:
          `✅ _Pesan perpisahan berhasil diatur._\n\n` +
          `│ Tampilan : *${keterangan}*\n` +
          `│ Teks : ${teksAkhir ? `_${teksAkhir}_` : '_(belum diatur)_'}\n\n` +
          `_Pastikan fitur sudah aktif dengan mengetik *${prefix}on left*_\n` +
          `_Coba tampilannya: *${prefix}tesleft*_`,
      },
      { quoted: message },
    );
  };

  // Foto/video/stiker yang dibalas atau ikut dikirim langsung dipakai.
  if (mediaPesan && mode !== 'text' && mode !== 'template') {
    const tersimpan = await simpanMediaSapaan(message, isQuoted, mediaPesan);

    if (!tersimpan || tersimpan.error) {
      await sock.sendMessage(
        remoteJid,
        {
          text:
            tersimpan?.error ||
            '⚠️ _Gagal menyimpan medianya, coba kirim ulang._',
        },
        { quoted: message },
      );
      return;
    }

    const fileLama = await setLeftMedia(remoteJid, tersimpan.tipe, tersimpan.file, tersimpan.gif);
    if (fileLama) deleteMedia(fileLama); // hemat penyimpanan panel

    const teksBaru = (mode === 'foto' || mode === 'video' ? sisa.join(' ') : isi).trim();
    await balas(labelMedia(tersimpan), teksBaru);
    return;
  }

  // Tanpa kata mode -> seluruh isi dianggap TEKS saja, seperti versi lama.
  if (!mode) {
    await setLeft(remoteJid, isi);
    await sock.sendMessage(
      remoteJid,
      {
        text:
          `✅ _Teks perpisahan berhasil disimpan._\n\n` +
          `_Ganti tampilannya dengan *${prefix}${command}* tanpa isi._\n\n` +
          `_Pastikan fitur sudah aktif dengan mengetik *${prefix}on left*_`,
      },
      { quoted: message },
    );
    return;
  }

  // Kata foto/video diketik TANPA media.
  if (mode === 'foto' || mode === 'video') {
    await sock.sendMessage(
      remoteJid,
      {
        text:
          `_⚠️ Balas atau kirim ${mode === 'foto' ? 'FOTO/STIKER' : 'VIDEO atau GIF'}-nya sambil mengetik perintah ini._\n\n` +
          `_💬 Contoh:_ _*${prefix}${command} Selamat jalan @name*_ _(sambil membalas fotonya)_`,
      },
      { quoted: message },
    );
    return;
  }

  if (mode === 'text') {
    await setTemplateLeft(remoteJid, 'text');
    await balas('Hanya teks', sisa.join(' ').trim());
    return;
  }

  // template -> gambar goodbye dari API
  await setTemplateLeft(remoteJid, 'default');
  await balas('Gambar goodbye', sisa.join(' ').trim());
}

export default {
  handle,
  Commands: ['setleft'],
  OnlyPremium: false,
  OnlyOwner: false,
};
