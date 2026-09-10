import { sendTextWithMentions } from '../../lib/utils.js';
import { readUsers } from '../../lib/users.js';
import { getGroupMetadata } from '../../lib/cache.js';
import mess from '../../strings.js';

const TOP_LIMIT = 10;
const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * Pilih SATU JID yang dipakai untuk menampilkan & me-mention user.
 *
 * Satu user bisa punya alias di dua ruang identitas (@s.whatsapp.net dan @lid).
 * Domain milik pengirim command diprioritaskan supaya mention terender benar di
 * grup tersebut, tapi bila user tidak punya alias bertipe itu kita TETAP pakai
 * alias yang ada — versi lama membuang user tersebut sehingga daftar top bisa
 * kurang dari 10 baris dan urutannya terlihat bolong.
 */
function pickDisplayJid(aliases, senderType) {
  if (!Array.isArray(aliases)) return null;

  const valid = aliases.filter((a) => typeof a === 'string' && a.includes('@'));
  if (valid.length === 0) return null;

  const preferred = senderType === 'lid' ? '@lid' : '@s.whatsapp.net';
  return valid.find((a) => a.endsWith(preferred)) || valid[0];
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

    // 1. Normalisasi dulu: money selalu berupa angka, dan setiap user harus
    //    punya identitas yang bisa ditampilkan.
    const candidates = Object.entries(dataUsers)
      .map(([docId, user]) => {
        const jid = pickDisplayJid(user?.aliases, senderType);
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

    // 2. Sortir berdasarkan money (terbesar di atas). Bila sama, urutkan
    //    berdasarkan username agar urutannya stabil (tidak berubah-ubah
    //    tiap kali command dipanggil).
    candidates.sort((a, b) => b.money - a.money || a.username.localeCompare(b.username));

    // 3. Baru dipotong 10 besar — pemotongan dilakukan SETELAH filter supaya
    //    jumlah baris yang tampil benar-benar 10 (bila datanya cukup).
    const topUsers = candidates.slice(0, TOP_LIMIT);

    if (topUsers.length === 0) {
      await sock.sendMessage(
        remoteJid,
        { text: '⚠️ Belum ada data pengguna untuk ditampilkan.' },
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

    const textNotif = `┏━『 *TOP ${topUsers.length} MEMBER* 』\n┣\n${aliasList}\n┗━━━━━━━━━━━━━━━`;

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
  Commands: ['topglobal', 'top'],
  OnlyPremium: false,
  OnlyOwner: false,
};
