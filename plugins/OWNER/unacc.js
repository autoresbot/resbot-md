import { unaccGroup } from '../../lib/accGroups.js';
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

  const dihapus = unaccGroup(groupId);

  let nama = '';
  if (groupId !== remoteJid) {
    const metadata = await getGroupMetadata(sock, groupId).catch(() => null);
    nama = metadata?.subject ? `\n\n_Grup:_ *${metadata.subject}*` : `\n\n_ID:_ ${groupId}`;
  }

  await sock.sendMessage(
    remoteJid,
    {
      text: dihapus
        ? `✅ _Bot dinonaktifkan di grup ini._${nama}\n\n_Bot tidak akan merespons siapa pun di sana kecuali owner. Ketik *${prefix}acc* untuk mengaktifkan lagi._`
        : `⚠️ _Bot memang belum aktif di grup ini._${nama}`,
    },
    { quoted: message },
  );
}

export default {
  handle,
  Commands: ['unacc'],
  OnlyPremium: false,
  OnlyOwner: true,
};
