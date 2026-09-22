import { cekSilent } from '../lib/silent.js';
import { isOwner } from '../lib/users.js';
import { logTracking } from '../lib/utils.js';

/**
 * User yang sedang di-silent (.silent):
 *  1. pesannya DIHAPUS bot, dan
 *  2. semua perintahnya DIABAIKAN (game/AFK/autoai/list ikut diam).
 *
 * Penghapusan butuh bot jadi admin grup. Kalau bukan admin, penghapusan gagal
 * tapi pengabaiannya tetap berlaku — jadi fiturnya tidak mati total.
 */
async function process(sock, messageInfo) {
  const { remoteJid, isGroup, sender, senderLid, id } = messageInfo;
  if (!isGroup) return true;

  try {
    // Owner tidak pernah ikut dibungkam — kalau tidak, owner bisa terkunci
    // dari grupnya sendiri tanpa cara membatalkan.
    if (isOwner(senderLid)) return true;

    const data = cekSilent(remoteJid, senderLid, sender);
    if (!data) return true;

    logTracking(`Silent Handler - hapus & abaikan pesan ${data.user_id} di ${remoteJid}`);

    // `fromMe: false` WAJIB eksplisit: zapo membangun key revoke dari
    // `key.fromMe` apa adanya, dan tanpa field ini WhatsApp menolak
    // penghapusan pesan orang lain tanpa memberi error yang terlihat.
    await sock
      .sendMessage(remoteJid, {
        delete: { remoteJid, id, participant: senderLid, fromMe: false },
      })
      .catch((error) => {
        // Paling sering: bot bukan admin grup.
        console.warn(`[SILENT] Gagal menghapus pesan di ${remoteJid}: ${error?.message || error}`);
      });

    return false; // hentikan pemrosesan: bot tidak menanggapi apa pun
  } catch (error) {
    console.error('Error dalam proses Silent:', error?.message || error);
    return true;
  }
}

export default {
  name: 'Silent',
  priority: 1, // paling awal: pesannya tidak perlu dilihat fitur lain
  process,
};
