import { reply } from '../../lib/utils.js';
import { findGroup } from '../../lib/group.js';
import { isAccGroup, listAccGroups } from '../../lib/accGroups.js';
import config from '../../config.js';

const ya = (nilai) => (nilai ? '✅' : '❌');

/** Lama bot menyala, mis. "2 hari 3 jam 5 menit". */
function formatUptime(detik) {
  const hari = Math.floor(detik / 86400);
  const jam = Math.floor((detik % 86400) / 3600);
  const menit = Math.floor((detik % 3600) / 60);
  return [hari && `${hari} hari`, jam && `${jam} jam`, `${menit} menit`].filter(Boolean).join(' ');
}

async function handle(sock, messageInfo) {
  const { m, remoteJid, isGroup } = messageInfo;

  // .self menyimpan penanda di data grup "owner"; .public menghapusnya.
  const modeSelf = Boolean(await findGroup('owner'));

  let jumlahAcc = '-';
  try {
    jumlahAcc = listAccGroups().length;
  } catch {
    // tabel acc belum siap — tampilkan '-'
  }

  const barisGrup = isGroup
    ? `│◧ Grup ini : ${isAccGroup(remoteJid) ? '✅ Sudah di-acc' : '❌ Belum di-acc (ketik .acc)'}\n`
    : '';

  const text = `╭「 Status 」
│
│◧ Versi : ${global.version}
│◧ Mode Bot : ${modeSelf ? '🔒 Self (hanya owner)' : '🌐 Public'}
│◧ Destination : ${config.bot_destination}
${barisGrup}│◧ Grup di-acc : ${jumlahAcc}
│◧ APIKEY : ${config.APIKEY ? '✅ Terisi' : '❌ Kosong'}
│◧ Owner : ${config.owner_number.length || 0}
│◧ Rate Limit : ${config.rate_limit} ms
│
│◧ Autoread : ${ya(config.autoread)}
│◧ Anti Call : ${ya(config.anticall)}
│◧ Auto Backup : ${ya(config.autobackup)}
│◧ Selalu Online : ${ya(config.always_online !== false)}
│
│◧ Uptime : ${formatUptime(process.uptime())}
│◧ RAM : ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB
│◧ Mode : ${config.mode}
╰────────────────────────◧`;

  await reply(m, text);
}

export default {
  handle,
  Commands: ['status'],
  OnlyPremium: false,
  OnlyOwner: false,
};
