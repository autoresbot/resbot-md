import { getAllUsersWithBirthday } from '../../lib/users.js';
import { sendMessageWithMention, convertToJid } from '../../lib/utils.js';

/**
 * Hitung hari menuju ulang tahun
 */
function daysUntilBirthday(birthday) {
  const [day, month] = birthday.split('-').map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let next = new Date(today.getFullYear(), month - 1, day);
  next.setHours(0, 0, 0, 0);

  if (next < today) {
    next.setFullYear(today.getFullYear() + 1);
  }

  return Math.floor((next - today) / 86400000);
}

/**
 * Nama bulan
 */
const BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

async function handle(sock, messageInfo) {
  const { remoteJid, message, senderType } = messageInfo;

  const allUsers = getAllUsersWithBirthday();

  if (!allUsers?.length) {
    return sock.sendMessage(
      remoteJid,
      { text: `📋 Belum ada yang mendaftarkan ulang tahun.` },
      { quoted: message },
    );
  }

  // ✅ pakai Promise.all agar await di dalam map valid
  const list = await Promise.all(
    allUsers.map(async ([id, userData]) => {
      const daysLeft = daysUntilBirthday(userData.birthday);

      const [dd, mm] = userData.birthday.split('-').map(Number);
      const namaBulan = BULAN[mm - 1];

      // ✅ bersihin nomor
      const nomor = userData.aliases?.[0]?.replace(/\D/g, '') || '';

      // ✅ convert ke jid
      const jid = await convertToJid(sock, nomor);

      // ✅ untuk mention cukup nomor (tanpa @s.whatsapp.net)
      const mentionNumber = jid?.split('@')[0] || nomor;

      // umur
      let ageInfo = '';
      if (userData.birthYear) {
        const now = new Date();
        const currentYear = now.getFullYear();

        const alreadyPassed =
          now.getMonth() + 1 > mm || (now.getMonth() + 1 === mm && now.getDate() > dd);

        const age =
          daysLeft === 0
            ? currentYear - userData.birthYear
            : currentYear - userData.birthYear + (alreadyPassed ? 1 : 0);

        ageInfo = ` (ke-${age})`;
      }

      return {
        daysLeft,
        mention: mentionNumber,
        text: `📌 @${mentionNumber}
   📅 ${dd} ${namaBulan}${ageInfo}
   ⏳ ${daysLeft === 0 ? '🎉 Hari ini!' : `${daysLeft} hari lagi`}`,
      };
    }),
  );

  // urutkan
  list.sort((a, b) => a.daysLeft - b.daysLeft);

  const lines = list.map((item, i) => `${i + 1}. ${item.text}`).join('\n\n');

  const text =
    `🎂 *Daftar Ulang Tahun*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    lines +
    `\n\n━━━━━━━━━━━━━━━━━━━━\n` +
    `Total: ${list.length} orang`;

  // ✅ kirim dengan mention
  return sendMessageWithMention(sock, remoteJid, text, message, senderType);
}

export default {
  handle,
  Commands: ['listultah'],
  OnlyPremium: false,
  OnlyOwner: false,
};
