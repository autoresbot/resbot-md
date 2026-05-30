import { setList, deleteMessage } from '../../lib/participants.js';
import { getGroupMetadata } from '../../lib/cache.js';
import mess from '../../strings.js';

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, content, sender, command, prefix } = messageInfo;

  // Periksa apakah pesan berasal dari grup
  if (!isGroup) return;

  // Mendapatkan metadata grup
  const groupMetadata = await getGroupMetadata(sock, remoteJid);
  const participants = groupMetadata.participants;

  // Periksa apakah pengirim adalah admin
  const isAdmin = participants.some(
    (p) => (p.phoneNumber === sender || p.id === sender) && p.admin,
  );
  if (!isAdmin) {
    await sock.sendMessage(remoteJid, { text: mess.general.isAdmin }, { quoted: message });
    return;
  }

  // Validasi input kosong
  if (!content || !content.trim()) {
    const usageMessage = `⚠️ *Format Penggunaan:*

💬 *Contoh:* 
_${prefix}${command} LIST STORE_

_Berikut Daftar list_
⌬ @x

════════════
_Parameter yang bisa di pakai_

☍ @x${global.group.variable}

_.setlist reset : untuk mereset template list_
`;

    await sock.sendMessage(remoteJid, { text: usageMessage }, { quoted: message });
    return;
  }

  // Atur template list
  await setList(remoteJid, content);

  if (content.toLowerCase() == 'reset') {
    await deleteMessage(remoteJid, 'setlist');
    await sock.sendMessage(remoteJid, { text: '_✅ Berhasil reset Setlist_' }, { quoted: message });
    return;
  }
  // Kirim pesan sukses
  const successMessage = `✅ _Set List Berhasil Diatur_

_Ketik *.list* untuk melihat daftar list_ atau ketik .setlist reset untuk mengembalikan ke semula`;

  await sock.sendMessage(remoteJid, { text: successMessage }, { quoted: message });
}

export default {
  handle,
  Commands: ['setlist'],
  OnlyPremium: false,
  OnlyOwner: false,
};
