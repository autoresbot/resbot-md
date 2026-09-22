import { getGroupMetadata, pesertaAdalahAdmin } from '../../lib/cache.js';
import { isOwner } from '../../lib/users.js';
import { getDataByGroupId } from '../../lib/list.js';
import { buatKodeClone, MASA_BERLAKU } from '../../lib/cloneList.js';
import mess from '../../strings.js';

/**
 * .idclone - dijalankan di grup SUMBER (yang list-nya mau disalin).
 * Menghasilkan kode yang dipakai admin grup lain lewat .clonegc <kode>.
 */
async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender, senderLid, prefix } = messageInfo;

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

  const data = await getDataByGroupId(remoteJid);
  const total = Object.keys(data?.list || {}).length;

  if (!total) {
    await sock.sendMessage(
      remoteJid,
      {
        text:
          `⚠️ _Grup ini belum punya list, jadi tidak ada yang bisa disalin._\n\n` +
          `_Tambahkan dulu dengan *${prefix}addlist*._`,
      },
      { quoted: message },
    );
    return;
  }

  const { kode } = buatKodeClone(remoteJid, senderLid || sender);
  const menit = Math.round(MASA_BERLAKU / 60000);

  await sock.sendMessage(
    remoteJid,
    {
      text:
        `🆔 _Kode clone list grup ini:_\n\n` +
        `*${kode}*\n\n` +
        `│ Jumlah list : *${total}*\n` +
        `│ Berlaku : *${menit} menit* (sekali pakai)\n\n` +
        `_Masuk ke grup tujuan, lalu ketik:_\n` +
        `*${prefix}clonegc ${kode}*\n\n` +
        `_⚠️ Jangan sebar kode ini. Siapa pun yang jadi admin di grup lain bisa menyalin list grup ini._`,
    },
    { quoted: message },
  );
}

export default {
  handle,
  Commands: ['idclone'],
  OnlyPremium: false,
  OnlyOwner: false,
};
