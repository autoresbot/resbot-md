import { sendMessageWithMention, resolveSendableJid } from '../../lib/utils.js';
import { getGroupMetadata, nomorDari } from '../../lib/cache.js';
import { daftarUltahGrup, pindahkanDataLama } from '../../lib/ultahGrup.js';

/**
 * Pilih JID nomor telepon (@s.whatsapp.net) untuk ditampilkan & di-mention.
 * Dulu listultah memakai aliases[0] mentah yang sering berupa nomor LID,
 * sehingga yang tampil adalah nomor LID, bukan nomor WhatsApp asli.
 */
async function resolvePhoneJid(sock, aliases) {
  const list = Array.isArray(aliases) ? aliases : [];

  // 1. Kalau sudah ada alias @s.whatsapp.net, itu nomor asli -> pakai langsung.
  const phone = list.find((a) => typeof a === 'string' && a.endsWith('@s.whatsapp.net'));
  if (phone) return phone;

  // 2. Kalau hanya ada LID / nomor, konversi via lidMapping (tidak pernah @lid).
  const first = list.find((a) => typeof a === 'string' && a);
  if (first) {
    const resolved = await resolveSendableJid(sock, first);
    if (resolved) return resolved;
  }
  return null;
}

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
  const { remoteJid, message, senderType, isGroup } = messageInfo;

  // Ulang tahun disimpan PER GRUP (lib/ultahGrup.js): daftar ini hanya berisi
  // yang mendaftar di grup ini, tidak ada hubungan dengan grup lain.
  if (!isGroup) {
    return sock.sendMessage(
      remoteJid,
      { text: `📋 Daftar ulang tahun hanya bisa dilihat di dalam grup.` },
      { quoted: message },
    );
  }

  const groupMetadata = await getGroupMetadata(sock, remoteJid);
  const participants = groupMetadata?.participants || [];

  // Data lama (sebelum per grup) dipindahkan sekali untuk anggota grup ini.
  pindahkanDataLama(remoteJid, participants);

  // Yang sudah keluar dari grup tidak ditampilkan. Identitas dicocokkan lewat
  // nomor telanjang karena peserta bisa tercatat sebagai LID atau nomor HP.
  const nomorAnggota = new Set(
    participants
      .flatMap((p) => [p.phoneNumber, p.id, p.jid, p.lid])
      .map(nomorDari)
      .filter(Boolean),
  );

  const allUsers = daftarUltahGrup(remoteJid)
    .filter(
      (row) =>
        !nomorAnggota.size || nomorAnggota.has(row.user_num) || nomorAnggota.has(row.phone_num),
    )
    .map((row) => [
      row.user_num,
      {
        birthday: row.birthday,
        birthYear: row.birth_year,
        // Nomor HP lebih dulu supaya yang tampil & di-mention nomor asli, bukan LID.
        aliases: [
          row.phone_num && `${row.phone_num}@s.whatsapp.net`,
          `${row.user_num}@lid`,
        ].filter(Boolean),
      },
    ]);

  if (!allUsers.length) {
    return sock.sendMessage(
      remoteJid,
      { text: `📋 Belum ada anggota grup ini yang mendaftarkan ulang tahun.` },
      { quoted: message },
    );
  }

  // ✅ pakai Promise.all agar await di dalam map valid
  const list = await Promise.all(
    allUsers.map(async ([id, userData]) => {
      const daysLeft = daysUntilBirthday(userData.birthday);

      const [dd, mm] = userData.birthday.split('-').map(Number);
      const namaBulan = BULAN[mm - 1];

      // ✅ Nomor WhatsApp ASLI (bukan LID)
      const jid = await resolvePhoneJid(sock, userData.aliases);
      const fallbackNumber = userData.aliases?.[0]?.replace(/\D/g, '') || '';

      // ✅ untuk mention cukup nomor (tanpa @s.whatsapp.net)
      const mentionNumber = jid?.split('@')[0] || fallbackNumber;

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
        jid: jid || (fallbackNumber ? `${fallbackNumber}@s.whatsapp.net` : null),
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

  // ✅ kirim dengan mention memakai JID nomor telepon secara eksplisit,
  // sehingga mention akurat dan tidak menebak domain dari senderType.
  const mentions = list.map((item) => item.jid).filter(Boolean);
  return sendMessageWithMention(sock, remoteJid, text, message, senderType, mentions);
}

export default {
  handle,
  Commands: ['listultah'],
  OnlyPremium: false,
  OnlyOwner: false,
};
