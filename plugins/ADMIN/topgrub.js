import { sendTextWithMentions } from '../../lib/utils.js';
import { readUsers } from '../../lib/users.js';
import { getGroupMetadata } from '../../lib/cache.js';
import mess from '../../strings.js';

const TOP_LIMIT = 10;
const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * Kumpulan identitas seluruh member grup.
 *
 * Participant bisa punya DUA identitas: `id` (biasanya @lid pada Baileys baru)
 * dan `phoneNumber` (@s.whatsapp.net). Versi lama hanya memakai `phoneNumber`,
 * sehingga di grup berbasis LID tidak ada satupun user yang cocok dan daftar
 * top selalu kosong. Bentuk nomor-saja ikut disimpan sebagai fallback bila
 * alias tersimpan tanpa domain yang sama.
 */
function collectGroupIdentifiers(participants) {
  const identifiers = new Set();
  for (const p of participants || []) {
    for (const ident of [p?.id, p?.phoneNumber]) {
      if (!ident || typeof ident !== 'string') continue;
      identifiers.add(ident);
      const number = ident.replace(/\D/g, '');
      if (number) identifiers.add(number);
    }
  }
  return identifiers;
}

function isGroupMemberAlias(alias, groupIdentifiers) {
  if (!alias || typeof alias !== 'string') return false;
  if (groupIdentifiers.has(alias)) return true;
  const number = alias.replace(/\D/g, '');
  return !!number && groupIdentifiers.has(number);
}

/**
 * Pilih SATU JID untuk ditampilkan & di-mention: harus alias yang benar-benar
 * ada di grup ini, dengan prioritas domain milik pengirim command supaya
 * mention terender dengan benar.
 */
function pickDisplayJid(aliases, groupIdentifiers, senderType) {
  if (!Array.isArray(aliases)) return null;

  const inGroup = aliases.filter(
    (a) => typeof a === 'string' && a.includes('@') && isGroupMemberAlias(a, groupIdentifiers),
  );
  if (inGroup.length === 0) return null;

  const preferred = senderType === 'lid' ? '@lid' : '@s.whatsapp.net';
  return inGroup.find((a) => a.endsWith(preferred)) || inGroup[0];
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

    const groupIdentifiers = collectGroupIdentifiers(participants);

    // 1. Ambil hanya user yang menjadi member grup ini, sekaligus normalisasi
    //    money menjadi angka dan tentukan identitas yang dipakai untuk mention.
    const candidates = Object.entries(dataUsers)
      .map(([docId, user]) => {
        const jid = pickDisplayJid(user?.aliases, groupIdentifiers, senderType);
        if (!jid) return null;

        const money = Number(user?.money);
        return {
          docId,
          jid,
          number: jid.split('@')[0],
          username: user?.username || '',
          money: Number.isFinite(money) ? money : 0,
        };
      })
      .filter(Boolean);

    // 2. Sortir berdasarkan money (terbesar di atas), tie-break username agar
    //    urutannya stabil antar pemanggilan.
    candidates.sort((a, b) => b.money - a.money || a.username.localeCompare(b.username));

    // 3. Potong 10 besar SETELAH filter, supaya jumlah baris yang tampil benar.
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

    // Kirim pesan dengan mention memakai JID lengkap tiap user, sehingga user
    // ber-@lid maupun ber-@s.whatsapp.net sama-sama ter-mention dengan benar.
    await sendTextWithMentions(
      sock,
      remoteJid,
      textNotif,
      topUsers.map((u) => u.jid),
      message,
    );
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
