import { setSilent, removeSilent, cekSilent, listSilent } from '../../lib/silent.js';
import { getGroupMetadata, pesertaAdalahAdmin, nomorDari } from '../../lib/cache.js';
import { isOwner } from '../../lib/users.js';
import { sendMessageWithMention } from '../../lib/utils.js';
import mess from '../../strings.js';

const DEFAULT_MENIT = 30;
const SELAMANYA = ['permanent', 'perm', 'forever', 'selamanya', '0'];

/**
 * "45m" -> 45 menit, "2h" -> 2 jam, "7d" -> 7 hari, "permanent" -> 0 (selamanya)
 * @returns {number|null} lama dalam milidetik, 0 = selamanya, null = bukan durasi
 */
function keMilidetik(teks) {
  const isi = String(teks || '').trim().toLowerCase();
  if (!isi) return null;
  if (SELAMANYA.includes(isi)) return 0;

  const cocok = /^(\d+)\s*(m|h|d|j|menit|jam|hari)$/i.exec(isi);
  if (!cocok) return null;

  const angka = Number(cocok[1]);
  if (!angka) return null;

  // Dicek sebagai kata utuh: "hari" dan "jam" sama-sama diawali huruf h/j,
  // jadi menebak dari huruf pertama saja bisa tertukar.
  const satuan = cocok[2].toLowerCase();
  if (satuan === 'd' || satuan === 'hari') return angka * 86400000;
  if (satuan === 'h' || satuan === 'j' || satuan === 'jam') return angka * 3600000;
  return angka * 60000; // m / menit
}

function keTeksDurasi(ms) {
  if (!ms) return 'selamanya';
  const menit = Math.round(ms / 60000);
  if (menit < 60) return `${menit} menit`;
  const jam = Math.round((menit / 60) * 10) / 10;
  if (jam < 24) return `${jam} jam`;
  return `${Math.round((jam / 24) * 10) / 10} hari`;
}

function bantuan(prefix, command) {
  return (
    `⚠️ *Format Penggunaan Command Silent*\n\n` +
    `📌 *Cara Penggunaan:*\n` +
    `• ${prefix}${command} @user [durasi] [alasan]\n` +
    `• Atau reply chat target lalu ketik: ${prefix}${command} [durasi] [alasan]\n\n` +
    `💡 *Contoh Penggunaan:*\n` +
    `• *${prefix}${command} @user*\n  _(Silent target selama ${DEFAULT_MENIT} menit [default])_\n` +
    `• *${prefix}${command} @user 45m*\n  _(Silent target selama 45 menit)_\n` +
    `• *${prefix}${command} @user 2h Toxic*\n  _(Silent target selama 2 jam dengan alasan 'Toxic')_\n` +
    `• *${prefix}${command} @user permanent Spam Chat*\n  _(Silent target selamanya dengan alasan 'Spam Chat')_\n\n` +
    `⏱️ *Format Durasi:*\n` +
    `• *m* : Menit (contoh: 15m, 30m)\n` +
    `• *h* : Jam (contoh: 1h, 12h)\n` +
    `• *d* : Hari (contoh: 1d, 7d)\n` +
    `• *permanent* / *perm* / *forever* / *0* : Selamanya\n\n` +
    `_Batalkan: *${prefix}unsilent @user*_\n` +
    `_Daftar: *${prefix}listsilent*_`
  );
}

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, content, sender, senderLid, mentionedJid, isQuoted, command, prefix, senderType } =
    messageInfo;
  if (!isGroup) return; // Only Grub

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

    const participants = groupMetadata.participants;
    const isAdmin = pesertaAdalahAdmin(participants, sender, senderLid) || isOwner(senderLid);

    if (!isAdmin) {
      await sock.sendMessage(remoteJid, { text: mess.general.isAdmin }, { quoted: message });
      return;
    }

    // ── Daftar user yang sedang di-silent ────────────────────────────────
    if (command === 'listsilent') {
      const daftar = listSilent(remoteJid);

      if (daftar.length === 0) {
        await sock.sendMessage(
          remoteJid,
          { text: '✅ _Tidak ada yang sedang di-silent di grup ini._' },
          { quoted: message },
        );
        return;
      }

      let teks = '🤐 *DAFTAR SILENT*\n\n';
      daftar.forEach((row, i) => {
        const sisa = row.until
          ? `${keTeksDurasi(Math.max(0, row.until - Date.now()))} lagi`
          : 'selamanya';
        teks += `${i + 1}. @${row.user_id}\n   ⏱️ ${sisa}${row.reason ? `\n   📌 ${row.reason}` : ''}\n`;
      });
      teks += `\n_Total: ${daftar.length}_`;

      await sendMessageWithMention(sock, remoteJid, teks, message, senderType);
      return;
    }

    // ── Tentukan target ──────────────────────────────────────────────────
    const target = mentionedJid?.[0] || (isQuoted ? isQuoted.sender : null);

    if (!target) {
      await sock.sendMessage(
        remoteJid,
        {
          text:
            command === 'unsilent'
              ? `_⚠️ Tag atau balas pesan orang yang ingin dibatalkan silent-nya._\n\n_💬 Contoh:_ _*${prefix}unsilent @user*_`
              : bantuan(prefix, command),
        },
        { quoted: message },
      );
      return;
    }

    const nomorTarget = nomorDari(target);

    // ── Batalkan silent ──────────────────────────────────────────────────
    if (command === 'unsilent') {
      const berhasil = removeSilent(remoteJid, target);
      await sendMessageWithMention(
        sock,
        remoteJid,
        berhasil
          ? `✅ _Silent untuk_ @${nomorTarget} _dibatalkan._`
          : `⚠️ @${nomorTarget} _memang tidak sedang di-silent._`,
        message,
        senderType,
      );
      return;
    }

    // ── Pasang silent ────────────────────────────────────────────────────
    if (isOwner(target)) {
      await sock.sendMessage(
        remoteJid,
        { text: '⚠️ _Owner bot tidak bisa di-silent._' },
        { quoted: message },
      );
      return;
    }

    if (pesertaAdalahAdmin(participants, target) && !isOwner(senderLid)) {
      await sock.sendMessage(
        remoteJid,
        { text: '⚠️ _Admin grup tidak bisa di-silent._' },
        { quoted: message },
      );
      return;
    }

    // Sisa teks: buang token mention, lalu kata pertama dicoba sebagai durasi
    const kata = (content || '')
      .split(/\s+/)
      .filter((k) => k && !k.startsWith('@'));

    const durasiMs = keMilidetik(kata[0]);
    const adaDurasi = durasiMs !== null;
    const lamaMs = adaDurasi ? durasiMs : DEFAULT_MENIT * 60000;
    const alasan = (adaDurasi ? kata.slice(1) : kata).join(' ').trim();

    setSilent(remoteJid, target, {
      sampai: lamaMs ? Date.now() + lamaMs : 0,
      alasan,
      oleh: senderLid || sender,
    });

    await sendMessageWithMention(
      sock,
      remoteJid,
      `🤐 @${nomorTarget} _berhasil di-silent._\n\n` +
        `⏱️ _Durasi: ${keTeksDurasi(lamaMs)}_\n` +
        `${alasan ? `📌 _Alasan: ${alasan}_\n` : ''}` +
        `\n_Pesannya akan dihapus otomatis & command-nya diabaikan._\n_Batalkan: *${prefix}unsilent @user*_`,
      message,
      senderType,
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
  Commands: ['silent', 'unsilent', 'listsilent'],
  MenuCommands: 'all',
  OnlyPremium: false,
  OnlyOwner: false,
};
