import { readGroup } from '../../lib/group.js';
import { groupFetchAllParticipating } from '../../lib/cache.js';

async function formatPremiumGrup(sock, index, grup, expired) {
  try {
    const inviteCode = await sock.groupInviteCode(grup.id);
    const groupLink = `https://chat.whatsapp.com/${inviteCode}`;

    return `╭─「 ${index} 」 *${grup.subject}*
│ Anggota : ${grup.participants.length}
│ ID Grup : ${grup.id}
│ Expired : ${new Date(expired).toLocaleDateString('id-ID')}
│ Link    : ${groupLink}
╰────────────────────────`;
  } catch (error) {
    return `╭─「 ${index} 」 *${grup.subject}*
│ Anggota : ${grup.participants.length}
│ ID Grup : ${grup.id}
│ Expired : ${new Date(expired).toLocaleDateString('id-ID')}
╰────────────────────────`;
  }
}

async function handle(sock, messageInfo) {
  const { remoteJid, message } = messageInfo;

  try {
    await sock.sendMessage(remoteJid, {
      react: { text: '⏰', key: message.key },
    });

    const groupsDB = await readGroup();
    const allGroups = await groupFetchAllParticipating(sock);

    // Ambil hanya grup premium
    const premiumGroups = Object.entries(groupsDB)
      .filter(([groupId, groupData]) => {
        return groupData?.fitur?.premium && new Date(groupData.fitur.premium) > new Date();
      })
      .map(([groupId, groupData]) => ({
        id: groupId,
        expired: groupData.fitur.premium,
      }));

    if (premiumGroups.length === 0) {
      return await sock.sendMessage(
        remoteJid,
        { text: '⚠️ Tidak ada grup premium saat ini.' },
        { quoted: message },
      );
    }

    const formattedGroups = await Promise.all(
      premiumGroups.map(async (group, index) => {
        const metadata = allGroups[group.id];

        if (!metadata) {
          return `╭─「 ${index + 1} 」 *Grup tidak ditemukan*
│ ID Grup : ${group.id}
│ Expired : ${new Date(group.expired).toLocaleDateString('id-ID')}
╰────────────────────────`;
        }

        return formatPremiumGrup(sock, index + 1, metadata, group.expired);
      }),
    );

    const responseMessage =
      `📋 *LIST GRUP PREMIUM*\n\n${formattedGroups.join('\n\n')}\n\n` +
      `Total Grup Premium: *${premiumGroups.length}*`;

    await sock.sendMessage(remoteJid, { text: responseMessage }, { quoted: message });
  } catch (error) {
    console.error('Error fetching premium groups:', error);

    await sock.sendMessage(
      remoteJid,
      { text: '_Terjadi kesalahan saat memproses perintah._' },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['listpremgc', 'listpremiumgrub', 'listpremgrub'],
  OnlyPremium: false,
  OnlyOwner: true,
};
