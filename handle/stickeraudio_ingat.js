/**
 * Catat VN/audio (termasuk mp3 yang dikirim sebagai file) yang membalas stiker/gambar (untuk `.sa`) dan stiker suara
 * yang masuk (untuk `.wm`) — lihat lib/stickerAudioCache.js. Hanya
 * mencatat — tidak pernah menghentikan pesan, dan tidak mengirim apa pun.
 */

import { ingatVisualDibalasVN, ingatStikerSuaraMasuk } from '../lib/stickerAudioCache.js';

async function process(sock, messageInfo) {
  try {
    // 'document': lagu .mp3 yang dikirim sebagai file (dicek isinya di
    // visualDibalasAudio, dokumen non-audio diabaikan).
    if (messageInfo?.type === 'audio' || messageInfo?.type === 'document') {
      ingatVisualDibalasVN(messageInfo.remoteJid, messageInfo.message);
    } else if (messageInfo?.type === 'sticker') {
      // Stiker suara yang masuk -> untuk .wm (lihat lib/stickerAudioCache.js).
      ingatStikerSuaraMasuk(messageInfo.remoteJid, messageInfo.message);
    }
  } catch {
    // Pencatatan ini hanya pelengkap .sa; kegagalannya tidak boleh
    // mengganggu pemrosesan pesan.
  }
  return true;
}

export default {
  name: 'StickerAudio Ingat',
  // Paling awal di antara handler preProcess, supaya handler lain (mis.
  // silent, list) yang menghentikan pesan tidak mencegah pencatatan.
  // Catatan: gerbang .acc & destination dicek di autoresbot.js SEBELUM
  // preProcess, jadi pesan di grup yang belum .acc tidak pernah sampai ke
  // sini, berapa pun prioritasnya — di grup itu .sa memang tidak jalan.
  priority: 0,
  process,
};
