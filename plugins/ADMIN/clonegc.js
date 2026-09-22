import { getGroupMetadata, pesertaAdalahAdmin } from '../../lib/cache.js';
import { isOwner } from '../../lib/users.js';
import { salinSemuaList } from '../../lib/list.js';
import { ambilKodeClone, hapusKodeClone, MASA_BERLAKU } from '../../lib/cloneList.js';
import { deleteCache } from '../../lib/globalCache.js';
import mess from '../../strings.js';

function pesanBantuan(prefix, command) {
  const menit = Math.round(MASA_BERLAKU / 60000);
  return (
    `_⚠️ Kode clone belum diisi._\n\n` +
    `_Cara menyalin list dari grup lain:_\n\n` +
    `_1. Masuk ke grup yang list-nya mau disalin_\n` +
    `_2. Ketik *${prefix}idclone* di sana (harus admin)_\n` +
    `_3. Kembali ke grup ini, lalu ketik:_\n` +
    `   *${prefix}${command} <kode>*\n\n` +
    `_💬 Contoh:_ *${prefix}${command} K7FQX2*\n` +
    `_Menimpa list yang namanya sama:_ *${prefix}${command} K7FQX2 timpa*\n\n` +
    `_Kode berlaku ${menit} menit dan hanya bisa dipakai sekali._`
  );
}

/**
 * .clonegc <kode> - dijalankan di grup TUJUAN.
 * Menyalin seluruh list grup sumber (lihat .idclone) ke grup ini.
 */
async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, content, sender, senderLid, command, prefix } = messageInfo;

  if (!isGroup) {
    await sock.sendMessage(
      remoteJid,
      { text: '_⚠️ Perintah ini hanya bisa dipakai di dalam grup._' },
      { quoted: message },
    );
    return;
  }

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

  const [kodeInput, ...sisa] = (content || '').trim().split(/\s+/);

  if (!kodeInput) {
    await sock.sendMessage(
      remoteJid,
      { text: pesanBantuan(prefix, command) },
      { quoted: message },
    );
    return;
  }

  const kode = kodeInput.toUpperCase();
  const timpa = sisa.some((kata) => ['timpa', 'replace'].includes(kata.toLowerCase()));
  const data = ambilKodeClone(kode);

  if (!data) {
    await sock.sendMessage(
      remoteJid,
      {
        text:
          `❌ _Kode *${kode}* tidak dikenal atau sudah kedaluwarsa._\n\n` +
          `_Minta kode baru dengan mengetik *${prefix}idclone* di grup sumbernya._`,
      },
      { quoted: message },
    );
    return;
  }

  if (data.sumberJid === remoteJid) {
    await sock.sendMessage(
      remoteJid,
      { text: '⚠️ _Kode ini milik grup ini sendiri. Pakai di grup tujuan, bukan di sini._' },
      { quoted: message },
    );
    return;
  }

  const hasil = await salinSemuaList(data.sumberJid, remoteJid, { timpa });

  if (!hasil.success) {
    await sock.sendMessage(
      remoteJid,
      { text: `❌ _${hasil.message}_` },
      { quoted: message },
    );
    return;
  }

  // Kode sekali pakai. Tapi kalau semua keyword dilewati, tidak ada yang
  // berubah -> kode dibiarkan hidup supaya admin bisa mengulang dengan "timpa".
  if (hasil.disalin) hapusKodeClone(kode);
  deleteCache(`list-${remoteJid}`);

  let teks =
    `✅ _List berhasil digabung ke grup ini._\n\n` +
    `│ List baru masuk : *${hasil.disalin}*\n` +
    `│ Dilewati : *${hasil.dilewati}*\n` +
    `│ Total di grup sumber : *${hasil.total}*\n\n` +
    `_List lama grup ini tidak dihapus, hanya ditambah._\n` +
    `_Ketik *list* untuk melihat hasilnya._`;

  if (hasil.dilewati && !timpa) {
    teks += `\n\n_${hasil.dilewati} keyword dilewati karena sudah ada di grup ini. Pakai *${prefix}${command} <kode> timpa* bila ingin ditimpa._`;
  }

  if (hasil.mediaGagal) {
    teks += `\n\n_⚠️ ${hasil.mediaGagal} media gagal disalin (file-nya sudah tidak ada). Teks list-nya tetap masuk._`;
  }

  await sock.sendMessage(remoteJid, { text: teks }, { quoted: message });
}

export default {
  handle,
  Commands: ['clonegc'],
  OnlyPremium: false,
  OnlyOwner: false,
};
