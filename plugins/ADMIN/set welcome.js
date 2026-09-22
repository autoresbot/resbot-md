import {
  setWelcome,
  setTemplateWelcome,
  setWelcomeMedia,
  checkMessage,
} from '../../lib/participants.js';
import { getGroupMetadata, pesertaAdalahAdmin } from '../../lib/cache.js';
import { isOwner } from '../../lib/users.js';
import { deleteMedia } from '../../lib/utils.js';
import { deteksiMediaSapaan, simpanMediaSapaan, labelMedia } from '../../lib/sapaanMedia.js';
import mess from '../../strings.js';

/**
 * Mode welcome. Angka disediakan sebagai jalan pintas supaya tidak perlu
 * menghafal kata kuncinya.
 */
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
    `_*${prefix}${command} <teks welcome>*_ _(balas foto/video/stiker → otomatis dipakai)_\n` +
    `_*${prefix}${command} text <teks welcome>*_\n` +
    `_*${prefix}${command} template <teks welcome>*_\n` +
    `_*${prefix}${command} template <1-7/random> <teks welcome>*_\n\n` +
    `_💬 Contoh:_\n` +
    `_*${prefix}${command} text Selamat datang @name di grup @group*_\n` +
    `_*${prefix}${command} template 1 Selamat datang @name*_\n` +
    `_*${prefix}${command} Selamat datang @name*_ _(sambil membalas foto/video)_\n\n` +
    `_*List Variable*_${global.group.variable}\n\n` +
    `_Lihat hasilnya: *${prefix}teswelcome*_`
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
    if (teksBaru) await setWelcome(remoteJid, teksBaru);
    let teksAkhir = teksBaru || (await checkMessage(remoteJid, 'add')) || '';

    // Belum pernah mengisi teks -> simpan teks bawaan sekalian, supaya
    // welcome-nya pasti terkirim (bukan diam) saat ada anggota baru.
    if (!teksAkhir) {
      teksAkhir = 'Selamat datang @name di grup @group';
      await setWelcome(remoteJid, teksAkhir);
    }

    await sock.sendMessage(
      remoteJid,
      {
        text:
          `✅ _Welcome berhasil diatur._\n\n` +
          `│ Tampilan : *${keterangan}*\n` +
          `│ Teks : ${teksAkhir ? `_${teksAkhir}_` : '_(belum diatur)_'}\n\n` +
          `_Pastikan fitur sudah aktif dengan mengetik *${prefix}on welcome*_\n` +
          `_Coba tampilannya: *${prefix}teswelcome*_`,
      },
      { quoted: message },
    );
  };

  // ── Ada foto/video/stiker yang dibalas atau ikut dikirim ──────────────────
  // Langsung dipakai sebagai welcome tanpa perlu mengetik kata "foto"/"video".
  // Kata "text" & "template" tetap menang, supaya admin bisa sengaja pindah
  // mode walau pesannya kebetulan membalas sebuah foto.
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

    const fileLama = await setWelcomeMedia(
      remoteJid,
      tersimpan.tipe,
      tersimpan.file,
      tersimpan.gif,
    );
    if (fileLama) deleteMedia(fileLama); // hemat penyimpanan panel

    // Kata "foto"/"video" (kalau tetap diketik) bukan bagian dari teks welcome.
    const teksBaru = (mode === 'foto' || mode === 'video' ? sisa.join(' ') : isi).trim();
    await balas(labelMedia(tersimpan), teksBaru);
    return;
  }

  // Tanpa kata mode -> seluruh isi dianggap TEKS saja (cara lama tetap jalan:
  // `.setwelcome Selamat datang @name`), tampilan yang dipilih dibiarkan.
  if (!mode) {
    await setWelcome(remoteJid, isi);
    await sock.sendMessage(
      remoteJid,
      {
        text:
          `✅ _Teks welcome berhasil disimpan._\n\n` +
          `_Ganti tampilannya dengan *${prefix}${command}* tanpa isi._\n\n` +
          `_Pastikan fitur sudah aktif dengan mengetik *${prefix}on welcome*_`,
      },
      { quoted: message },
    );
    return;
  }

  // ── Kata foto/video diketik TANPA media ───────────────────────────────────
  if (mode === 'foto' || mode === 'video') {
    await sock.sendMessage(
      remoteJid,
      {
        text:
          `_⚠️ Balas atau kirim ${mode === 'foto' ? 'FOTO/STIKER' : 'VIDEO atau GIF'}-nya sambil mengetik perintah ini._\n\n` +
          `_💬 Contoh:_ _*${prefix}${command} Selamat datang @name*_ _(sambil membalas fotonya)_`,
      },
      { quoted: message },
    );
    return;
  }

  if (mode === 'text') {
    await setTemplateWelcome(remoteJid, 'text');
    await balas('Hanya teks', sisa.join(' ').trim());
    return;
  }

  // ── Template gambar ───────────────────────────────────────────────────────
  const pilihan = (sisa[0] || '').toLowerCase();

  // `template` tanpa nomor (atau langsung diikuti teks) -> template baru yang
  // hanya butuh foto profil & nama.
  if (!pilihan || !/^(\d+|random)$/.test(pilihan)) {
    await setTemplateWelcome(remoteJid, 'default');
    await balas('Gambar welcome', sisa.join(' ').trim());
    return;
  }

  if (!/^([1-7]|random)$/.test(pilihan)) {
    await sock.sendMessage(
      remoteJid,
      {
        text:
          `_⚠️ Pilih template *1* sampai *7*, atau *random*._\n\n` +
          `_💬 Contoh:_ _*${prefix}${command} template 1 Selamat datang @name*_\n\n` +
          `_Lihat contohnya: *${prefix}teswelcome 1*_`,
      },
      { quoted: message },
    );
    return;
  }

  await setTemplateWelcome(remoteJid, pilihan);
  await balas(
    pilihan === 'random' ? 'Template acak' : `Template ${pilihan}`,
    sisa.slice(1).join(' ').trim(),
  );
}

export default {
  handle,
  Commands: ['setwelcome'],
  OnlyPremium: false,
  OnlyOwner: false,
};
