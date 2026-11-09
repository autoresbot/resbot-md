import { sendMessageWithMention } from '../../lib/utils.js';
import { readUsers } from '../../lib/users.js';
import { getGroupMetadata } from '../../lib/cache.js';
import mess from '../../strings.js';

const TOP_LIMIT = 10;
const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * Peta nomor (digit tanpa domain) -> money, dari SELURUH data user.
 * Dipakai untuk menempelkan saldo ke tiap peserta grup.
 */
function buildMoneyByNumber(dataUsers) {
  const map = new Map();
  for (const user of Object.values(dataUsers || {})) {
    const money = Number(user?.money);
    const nilai = Number.isFinite(money) ? money : 0;
    for (const alias of user?.aliases ?? []) {
      if (typeof alias !== 'string') continue;
      const number = alias.replace(/\D/g, '');
      if (number && !map.has(number)) map.set(number, nilai);
    }
  }
  return map;
}

function formatMoney(value) {
  const num = Number(value);
  return (Number.isFinite(num) ? num : 0).toLocaleString('id-ID');
}

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender, senderType } = messageInfo;
  if (!isGroup) return; // Hanya untuk grup

  try {
    // Mendapatkan metadata grup
    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    const participants = groupMetadata.participants;
    const isAdmin = participants.some(
      (p) => (p.phoneNumber === sender || p.id === sender) && p.admin,
    );
    if (!isAdmin) {
      await sock.sendMessage(remoteJid, { text: mess.general.isAdmin }, { quoted: message });
      return;
    }

    // Baca data user dari database atau file
    const dataUsers = await readUsers();
    const moneyByNumber = buildMoneyByNumber(dataUsers);

    // Daftar dibangun dari PESERTA GRUP (sama seperti .listadmin / .tagall) agar
    // mention bisa ter-render — WhatsApp hanya bisa men-tag anggota grup ini.
    // JID untuk mention: `phoneNumber` (@s.whatsapp.net) diutamakan, jatuh ke
    // `id` (@lid) bila peserta tidak membawa nomor telepon.
    const candidates = participants
      .map((p) => {
        const jid = p?.phoneNumber || p?.id;
        if (typeof jid !== 'string' || !jid.includes('@')) return null;

        let money = 0;
        for (const ident of [p.id, p.phoneNumber]) {
          if (typeof ident !== 'string') continue;
          const number = ident.replace(/\D/g, '');
          if (number && moneyByNumber.has(number)) {
            money = moneyByNumber.get(number);
            break;
          }
        }

        return { jid, number: jid.split('@')[0], money };
      })
      .filter(Boolean);

    // Sortir berdasarkan money (terbesar di atas), tie-break nomor agar stabil.
    candidates.sort((a, b) => b.money - a.money || a.number.localeCompare(b.number));

    const topUsers = candidates.slice(0, TOP_LIMIT);

    if (topUsers.length === 0) {
      await sock.sendMessage(
        remoteJid,
        { text: '⚠️ Belum ada member grup ini yang terdaftar di database.' },
        { quoted: message },
      );
      return;
    }

    const aliasList = topUsers
      .map((user, index) => {
        const rank = MEDALS[index] || `${index + 1}.`;
        return `┣ ${rank} @${user.number} - 💰 ${formatMoney(user.money)}`;
      })
      .join('\n');

    const textNotif = `┏━『 *TOP ${topUsers.length} MEMBER GRUP* 』\n┣\n${aliasList}\n┗━━━━━━━━━━━━━━━`;

    // Kirim dengan mention eksplisit lewat helper yang sama dengan .listadmin.
    const mentions = topUsers.map((u) => u.jid);
    await sendMessageWithMention(sock, remoteJid, textNotif, message, senderType, mentions);
  } catch (error) {
    console.error('Error in handle:', error);
    await sock.sendMessage(
      remoteJid,
      { text: '⚠️ Terjadi kesalahan saat menampilkan daftar pengguna.' },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['topgrub'],
  OnlyPremium: false,
  OnlyOwner: false,
};
