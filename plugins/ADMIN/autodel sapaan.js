import { setAutoDelete, getAutoDelete } from '../../lib/participants.js';
import { getGroupMetadata, pesertaAdalahAdmin } from '../../lib/cache.js';
import { isOwner } from '../../lib/users.js';
import mess from '../../strings.js';

/** Batas aman: lewat sejauh ini pesannya lebih baik dibiarkan saja. */
const MAKS_DETIK = 60 * 60; // 60 menit

/**
 * "10s" -> 10, "1m" -> 60, "90" -> 90 (tanpa satuan dianggap detik).
 * @returns {number|null} null bila formatnya tidak dikenali
 */
function keDetik(teks) {
  const cocok = /^(\d+)\s*(s|d|detik|m|menit)?$/i.exec(String(teks).trim());
  if (!cocok) return null;

  const angka = Number(cocok[1]);
  if (!angka) return null;

  const satuan = (cocok[2] || 's').toLowerCase();
  return satuan.startsWith('m') ? angka * 60 : angka;
}

/** 10 -> "10 detik", 90 -> "1 menit 30 detik" */
function keTeks(detik) {
  const menit = Math.floor(detik / 60);
  const sisa = detik % 60;
  if (!menit) return `${sisa} detik`;
  return sisa ? `${menit} menit ${sisa} detik` : `${menit} menit`;
}

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, content, sender, senderLid, command, prefix } = messageInfo;
  if (!isGroup) return; // Only Grub

  const jenis = command === 'autodelleft' ? 'left' : 'welcome';
  const label = jenis === 'left' ? 'Left' : 'Welcome';

  try {
    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    if (!groupMetadata?.participants) {
      await sock.sendMessage(
        remoteJid,
        { text: '⚠️ _Gagal mengambil data grup, coba lagi beberapa saat._' },
        { quoted: message },
      );
      return;
    }

    const isAdmin =
      pesertaAdalahAdmin(groupMetadata.participants, sender, senderLid) || isOwner(senderLid);

    if (!isAdmin) {
      await sock.sendMessage(remoteJid, { text: mess.general.isAdmin }, { quoted: message });
      return;
    }

    const isi = (content || '').trim().toLowerCase();
    const aktifSekarang = getAutoDelete(remoteJid, jenis);

    // ── Cek status ────────────────────────────────────────────────────────
    if (isi === 'cek' || isi === 'status') {
      await sock.sendMessage(
        remoteJid,
        {
          text: aktifSekarang
            ? `📋 _Auto Delete ${label}: *AKTIF*_\n\n_Pesan ${label.toLowerCase()} dihapus setelah *${keTeks(aktifSekarang)}*._\n\n_Matikan: *${prefix}${command} off*_`
            : `📋 _Auto Delete ${label}: *TIDAK AKTIF*_\n\n_Aktifkan: *${prefix}${command} 30s*_`,
        },
        { quoted: message },
      );
      return;
    }

    // ── Matikan ───────────────────────────────────────────────────────────
    if (isi === 'off' || isi === '0') {
      if (!aktifSekarang) {
        await sock.sendMessage(
          remoteJid,
          { text: `⚠️ _Auto Delete ${label} memang belum aktif._` },
          { quoted: message },
        );
        return;
      }

      await setAutoDelete(remoteJid, jenis, null);
      await sock.sendMessage(
        remoteJid,
        { text: `✅ _Auto Delete ${label} dimatikan._\n\n_Pesan ${label.toLowerCase()} tidak akan dihapus lagi._` },
        { quoted: message },
      );
      return;
    }

    // ── Atur durasi ───────────────────────────────────────────────────────
    const detik = isi ? keDetik(isi) : null;

    if (!detik) {
      await sock.sendMessage(
        remoteJid,
        {
          text:
            `_⚠️ Format Penggunaan Auto Delete ${label}:_\n\n` +
            `_💬 Contoh:_\n` +
            `_*${prefix}${command} 10s*_\n_*${prefix}${command} 30s*_\n_*${prefix}${command} 1m*_\n` +
            `_*${prefix}${command} 5m*_\n_*${prefix}${command} off*_\n_*${prefix}${command} cek*_\n\n` +
            `_Keterangan:_\n` +
            `_10s = hapus ${label.toLowerCase()} setelah 10 detik_\n` +
            `_1m = hapus ${label.toLowerCase()} setelah 1 menit_\n` +
            `_off = matikan auto delete ${label.toLowerCase()}_\n` +
            `_cek = cek status auto delete ${label.toLowerCase()}_\n\n` +
            `_Batas maksimal durasi: 60 menit_`,
        },
        { quoted: message },
      );
      return;
    }

    if (detik > MAKS_DETIK) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Durasi terlalu lama (${keTeks(detik)})._\n\n_Batas maksimal: *60 menit*._`,
        },
        { quoted: message },
      );
      return;
    }

    await setAutoDelete(remoteJid, jenis, detik);

    await sock.sendMessage(
      remoteJid,
      {
        text:
          `✅ _Auto Delete ${label} diaktifkan._\n\n` +
          `│ Durasi : *${keTeks(detik)}*\n\n` +
          `_Pesan ${label.toLowerCase()} akan dihapus otomatis setelah ${keTeks(detik)}._\n` +
          `_Matikan: *${prefix}${command} off*_`,
      },
      { quoted: message },
    );
  } catch (error) {
    console.error(`Error handling ${command}:`, error);
    await sock.sendMessage(
      remoteJid,
      { text: `_Error: ${error.message || 'Terjadi kesalahan tak dikenal.'}_` },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['autodelwelcome', 'autodelleft'],
  MenuCommands: 'all', // dua fitur berbeda, keduanya tampil di menu
  OnlyPremium: false,
  OnlyOwner: false,
};
