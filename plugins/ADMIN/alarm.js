import mess from '../../strings.js';
import { getGroupMetadata, pesertaAdalahAdmin } from '../../lib/cache.js';
import { isOwner } from '../../lib/users.js';
import { sessions } from '../../lib/cache.js';
import {
  parseAlarm,
  daftarAlarm,
  simpanAlarm,
  hapusAlarm,
  syncAlarm,
  MODE_TAG,
  MAKS_ALARM_PER_GRUP,
} from '../../lib/alarm.js';

const LABEL_MODE = {
  none: '💬 tanpa tag',
  tagall: '📢 tag all',
  hidetag: '🔕 tag tersembunyi',
};

/** Versi ringkas LABEL_MODE untuk daftar `.alarm` yang cuma satu baris. */
const IKON_MODE = {
  none: '💬',
  tagall: '📢',
  hidetag: '🔕',
};

function contohPenggunaan(prefix) {
  return `_⏰ *ALARM GRUP* — pesan otomatis tiap hari_

_📌 Format:_
_*${prefix}addalarm nama | pesan | jam | opsi*_

_📝 Contoh:_
_*${prefix}addalarm pagi | Selamat pagi semua, semangat hari ini! | 06:00 | --tagall*_
_*${prefix}addalarm tidur | Jangan lupa istirahat ya | 22:00*_

_⚙️ Opsi tag (boleh dikosongkan):_
_• tanpa opsi = pesan biasa_
_• *--tagall* = pesan + tag semua anggota_
_• *--hidetag* = tag semua tapi daftarnya disembunyikan_

_🕒 Jam memakai format 24 jam WIB (06:00, 6:00, atau 06.00)_

_📋 Lihat daftar: *${prefix}alarm*_
_🗑️ Hapus: *${prefix}delalarm pagi* / *${prefix}delalarm 1* / *${prefix}delalarm all*_`;
}

/** Socket sesi utama — dipakai untuk menjadwalkan ulang setelah data berubah. */
function ambilSock(sock) {
  return sessions.get('session') ?? sock;
}

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, content, sender, senderLid, command, prefix } = messageInfo;

  const balas = (text) => sock.sendMessage(remoteJid, { text }, { quoted: message });

  if (!isGroup) {
    return balas('_⚠️ Fitur alarm hanya bisa dipakai di dalam grup._');
  }

  try {
    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    const participants = groupMetadata?.participants ?? [];
    const isAdmin = pesertaAdalahAdmin(participants, sender, senderLid);

    if (!isAdmin && !isOwner(senderLid)) {
      return balas(mess.general.isAdmin);
    }

    const argumen = (content || '').trim();

    /* ------------------------- .alarm ------------------------- */
    if (command === 'alarm' || command === 'listalarm') {
      const daftar = daftarAlarm(remoteJid);
      if (!daftar.length) {
        return balas(
          `_📭 Belum ada alarm di grup ini._\n\n${contohPenggunaan(prefix)}`,
        );
      }

      // Satu baris per alarm: nama + jam saja. Isi pesannya sengaja tidak
      // ditampilkan supaya daftarnya tetap pendek walau alarmnya banyak.
      const isi = daftar
        .map(
          (alarm, index) =>
            `${index + 1}. *${alarm.name}* — ${alarm.time} WIB ${IKON_MODE[alarm.tag] ?? IKON_MODE.none}`,
        )
        .join('\n');

      return balas(
        `_⏰ *DAFTAR ALARM GRUP* (${daftar.length}/${MAKS_ALARM_PER_GRUP})_\n\n${isi}\n\n` +
          `_💬 tanpa tag · 📢 tag all · 🔕 tag tersembunyi_\n` +
          `_🗑️ Hapus dengan *${prefix}delalarm <nama/nomor>*_`,
      );
    }

    /* ------------------------ .delalarm ----------------------- */
    if (command === 'delalarm' || command === 'hapusalarm') {
      if (!argumen) {
        return balas(
          `_⚠️ Sebutkan alarm yang ingin dihapus._\n\n` +
            `_💬 Contoh: *${prefix}delalarm pagi*, *${prefix}delalarm 1*, atau *${prefix}delalarm all*_`,
        );
      }

      const { terhapus, nama } = hapusAlarm(remoteJid, argumen);
      if (!terhapus) {
        return balas(
          `_❌ Alarm *${argumen}* tidak ditemukan._\n\n_Cek daftarnya dengan *${prefix}alarm*_`,
        );
      }

      syncAlarm(ambilSock(sock));
      return balas(`_✅ ${terhapus} alarm dihapus:_ _*${nama.join(', ')}*_`);
    }

    /* ------------------------ .addalarm ----------------------- */
    if (!argumen) {
      return balas(contohPenggunaan(prefix));
    }

    const hasil = parseAlarm(argumen);
    if (!hasil.ok) {
      const alasan = {
        waktu: '_⚠️ Jam tidak ditemukan atau tidak valid. Pakai format 24 jam, misal *06:00*._',
        nama: '_⚠️ Nama alarm belum diisi._',
        pesan: '_⚠️ Isi pesan alarm belum diisi._',
        panjang: '_⚠️ Pesan alarm terlalu panjang (maksimal 2000 karakter)._',
        kosong: '_⚠️ Format belum lengkap._',
      };
      return balas(`${alasan[hasil.alasan] ?? alasan.kosong}\n\n${contohPenggunaan(prefix)}`);
    }

    const simpan = simpanAlarm(remoteJid, hasil.data, senderLid || sender || '');
    if (!simpan.ok) {
      return balas(
        `_⚠️ Alarm di grup ini sudah mencapai batas ${MAKS_ALARM_PER_GRUP}._\n\n` +
          `_Hapus salah satu dulu dengan *${prefix}delalarm <nama>*_`,
      );
    }

    syncAlarm(ambilSock(sock));

    const { name, time, tag, message: isiPesan } = hasil.data;
    return balas(
      `_✅ Alarm *${name}* ${simpan.diperbarui ? 'diperbarui' : 'ditambahkan'}._\n\n` +
        `⏰ _Jam:_ *${time} WIB* (setiap hari)\n` +
        `${LABEL_MODE[tag]} _(${MODE_TAG[tag]})_\n` +
        `💬 _Pesan:_\n${isiPesan}\n\n` +
        `_📋 Lihat semua: *${prefix}alarm*_`,
    );
  } catch (error) {
    console.error('Error alarm:', error);
    return balas(`_⚠️ Terjadi kesalahan: ${error.message}_`);
  }
}

export default {
  handle,
  Commands: ['addalarm', 'alarm', 'listalarm', 'delalarm', 'hapusalarm'],
  // Tiga perintah berbeda dalam satu berkas — semuanya harus tampil di menu,
  // kecuali aliasnya (listalarm/hapusalarm).
  MenuCommands: ['addalarm', 'alarm', 'delalarm'],
  OnlyPremium: false,
  OnlyOwner: false,
};
