import { findGroup } from '../../lib/group.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message, sender } = messageInfo;

  try {
    // Ambil data group
    const groupData = await findGroup(remoteJid);

    if (!groupData) {
      return await sock.sendMessage(
        remoteJid,
        { text: '❌ Data grup tidak ditemukan.' },
        { quoted: message },
      );
    }

    // Tentukan status premium
    let premiumStatus;

    if (groupData?.fitur?.premium) {
      const premiumEndDate = new Date(groupData.fitur.premium);
      const now = new Date();

      if (premiumEndDate > now) {
        premiumStatus = `📋 _Grup ini memiliki premium hingga:_ ${premiumEndDate.toLocaleString(
          'id-ID',
        )}`;
      } else {
        premiumStatus = '📋 _Masa premium grup ini sudah berakhir_';
      }
    } else {
      premiumStatus = '📋 _Grup ini tidak memiliki premium_';
    }

    const responseText = `_Halo_ @${sender.split('@')[0]}\n\n${premiumStatus}`;

    await sock.sendMessage(
      remoteJid,
      { text: responseText, mentions: [sender] },
      { quoted: message },
    );
  } catch (error) {
    console.error('Error handling group premium:', error);

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
  Commands: ['cekpremgc', 'cekpremgrub', 'cekpremiumgrub', 'cekpremiumgc'],
  OnlyPremium: false,
  OnlyOwner: false,
};
