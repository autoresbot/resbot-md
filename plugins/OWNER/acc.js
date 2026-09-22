import { accGroup } from '../../lib/accGroups.js';
import { targetGrup } from '../../lib/accPilihan.js';
import { getGroupMetadata } from '../../lib/cache.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message, isGroup, senderLid, content, prefix, command } = messageInfo;

  const { id: groupId, pesan } = targetGrup({
    content,
    senderLid,
    remoteJid,
    isGroup,
    prefix,
    command,
  });

  if (!groupId) {
    await sock.sendMessage(remoteJid, { text: pesan }, { quoted: message });
    return;
  }

  const baru = accGroup(groupId, senderLid);

  // Nama grup ikut ditampilkan saat di-acc dari chat pribadi, supaya owner
  // yakin grup yang diaktifkan memang yang dia maksud.
  let nama = '';
  if (groupId !== remoteJid) {
    const metadata = await getGroupMetadata(sock, groupId).catch(() => null);
    nama = metadata?.subject ? `\n\n_Grup:_ *${metadata.subject}*` : `\n\n_ID:_ ${groupId}`;
  }

  await sock.sendMessage(
    remoteJid,
    {
      text: baru
        ? `✅ _Bot berhasil diaktifkan di grup ini._${nama}\n\n_Untuk menonaktifkan ketik *${prefix}unacc*_`
        : `✅ _Bot sudah aktif di grup ini._${nama}`,
    },
    { quoted: message },
  );
}

export default {
  handle,
  Commands: ['acc'],
  OnlyPremium: false,
  OnlyOwner: true,
};
