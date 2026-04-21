import { sendMessageWithMention } from '../../lib/utils.js';
import mess from '../../strings.js';
import { getActiveUsers } from '../../lib/users.js';
import { getGroupMetadata } from '../../lib/cache.js';

const TOTAL_HARI_SIDER = 30;

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender, senderType } = messageInfo;
  if (!isGroup) return;

  try {
    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    const participants = groupMetadata.participants;

    const isAdmin = participants.some(
      (p) => (p.phoneNumber === sender || p.id === sender) && p.admin,
    );

    if (!isAdmin) {
      await sock.sendMessage(remoteJid, { text: mess.general.isAdmin }, { quoted: message });
      return;
    }

    const listNotSider = await getActiveUsers(TOTAL_HARI_SIDER);

    if (listNotSider.length === 0) {
      return await sock.sendMessage(
        remoteJid,
        { text: '📋 _Tidak ada member sider di grup ini._' },
        { quoted: message },
      );
    }

    // === PAKAI phoneNumber ===
    const siderMembers = participants.filter(
      (participant) =>
        !listNotSider.some((active) => active.phoneNumber === participant.phoneNumber),
    );

    const memberList = siderMembers
      .map((p) => {
        const number = p.phoneNumber?.split('@')[0] || p.id?.split('@')[0]; // fallback aman
        return `◧ @${number}`;
      })
      .join('\n');

    const countSider = siderMembers.length;

    const teks_sider = `_*${countSider} Dari ${participants.length}* Anggota Grup ${groupMetadata.subject} Adalah Sider_
        
_*Dengan Alasan :*_
➊ _Tidak Aktif Selama lebih dari ${TOTAL_HARI_SIDER} hari_
➋ _Join Tapi Tidak Pernah Nimbrung_

_Harap Aktif Di Grup Karena Akan Ada Pembersihan Member Setiap Saat_

_*List Member Sider*_
${memberList}`;

    await sendMessageWithMention(sock, remoteJid, teks_sider, message, senderType);
  } catch (error) {
    console.error('Error handling listalluser:', error);
    await sock.sendMessage(
      remoteJid,
      { text: '⚠️ Terjadi kesalahan saat menampilkan semua anggota grup.' },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['gcsider'],
  OnlyPremium: false,
  OnlyOwner: false,
};
