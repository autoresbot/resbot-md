import { setGroupSchedule, setJadwalTeks, getJadwalTeks } from '../../lib/participants.js';
import { getGroupMetadata, pesertaAdalahAdmin } from '../../lib/cache.js';
import { isOwner } from '../../lib/users.js';
import mess from '../../strings.js';
import { convertTime, getTimeRemaining } from '../../lib/utils.js';

const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d$/; // HH:mm

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, content, sender, senderLid, command, prefix } = messageInfo;
  if (!isGroup) return; // Hanya untuk grup

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

  if (!isi) {
    await sock.sendMessage(
      remoteJid,
      {
        text:
          `_⚠️ Format Penggunaan:_\n\n` +
          `_💬 Contoh:_\n` +
          `_*${prefix}${command} 23:10*_\n` +
          `_*${prefix}${command} 23:10 Grup sudah dibuka, silakan mulai chat ya*_\n` +
          `_*${prefix}${command} off*_\n\n` +
          `_Keterangan:_\n` +
          `_- Jika hanya isi jam, bot memakai teks default._\n` +
          `_- Jika isi jam + teks, bot akan mengirim teks custom saat grup dibuka otomatis._\n` +
          `_- Bot akan membuka grup otomatis pada jam tersebut setiap hari._\n\n` +
          `_Untuk menghapus jadwal open grup otomatis:_\n_*${prefix}${command} off*_`,
      },
      { quoted: message },
    );
    return;
  }

  // ── Hapus jadwal ────────────────────────────────────────────────────────
  if (isi.toLowerCase() === 'off') {
    await setGroupSchedule(sock, remoteJid, 'off', 'openTime');
    await setJadwalTeks(remoteJid, 'openText', ''); // teks custom ikut dibuang

    await sock.sendMessage(
      remoteJid,
      { text: '_✅ Open Grub otomatis berhasil di hapus_' },
      { quoted: message },
    );
    return;
  }

  // ── Jam + teks (teks opsional) ──────────────────────────────────────────
  const [jam, ...sisa] = isi.split(/\s+/);
  const teksCustom = sisa.join(' ').trim();

  if (!TIME_REGEX.test(jam)) {
    await sock.sendMessage(
      remoteJid,
      {
        text:
          `_⚠️ Format jam tidak valid!_\n\n_Pastikan format jam adalah HH:mm (contoh: 23:10)_\n\n` +
          `_💬 Contoh:_ _*${prefix}${command} 23:10 Grup sudah dibuka*_`,
      },
      { quoted: message },
    );
    return;
  }

  await setGroupSchedule(sock, remoteJid, jam, 'openTime');

  // Teks kosong -> pakai teks bawaan. Teks lama TIDAK dipertahankan diam-diam,
  // supaya `.setopengc 23:10` benar-benar berarti "jam saja, teks default".
  await setJadwalTeks(remoteJid, 'openText', teksCustom);

  const serverTime = convertTime(jam);
  const { hours, minutes } = getTimeRemaining(serverTime);
  const teksDipakai = getJadwalTeks(remoteJid, 'openText') || mess.action.grub_open;

  await sock.sendMessage(
    remoteJid,
    {
      text:
        `✅ _Berhasil, Grup otomatis dibuka pada jam *${jam}* WIB_\n` +
        `⏰ _Sekitar ${hours} jam ${minutes} menit lagi_\n\n` +
        `│ Pesan : _${teksDipakai}_${teksCustom ? '' : ' _(default)_'}\n\n` +
        `_Pastikan bot sudah admin untuk menggunakan fitur ini_`,
    },
    { quoted: message },
  );
}

export default {
  handle,
  Commands: ['setopengc'],
  OnlyPremium: false,
  OnlyOwner: false,
};
