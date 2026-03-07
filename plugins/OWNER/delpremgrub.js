import { findGroup, updateGroup } from '../../lib/group.js';
import { sendMessageWithMention } from '../../lib/utils.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message, sender, senderType } = messageInfo;

  try {
    // Ambil data grup
    const groupData = await findGroup(remoteJid);

    if (!groupData) {
      return await sock.sendMessage(
        remoteJid,
        { text: '❌ Data grup tidak ditemukan.' },
        { quoted: message },
      );
    }

    // Jika grup tidak memiliki premium
    if (!groupData?.fitur?.premium) {
      return await sock.sendMessage(
        remoteJid,
        { text: '⚠️ Grup ini tidak memiliki premium.' },
        { quoted: message },
      );
    }

    // Hapus premium
    const updateData = {
      fitur: {
        ...groupData.fitur,
        premium: null,
      },
    };

    await updateGroup(remoteJid, updateData);

    const responseText = `✅ *Premium grup berhasil dihapus.*`;

    await sendMessageWithMention(sock, remoteJid, responseText, message, senderType);
  } catch (error) {
    console.error('Error deleting group premium:', error);

    await sock.sendMessage(
      remoteJid,
      {
        text: 'Terjadi kesalahan saat memproses data. Silakan coba lagi nanti.',
      },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['delpremgc', 'delpremgrub', 'delpremiumgrub'],
  OnlyPremium: false,
  OnlyOwner: true,
};
