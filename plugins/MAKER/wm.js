import fs from 'fs';
import webpmux from 'node-webpmux';
import {
  downloadQuotedMedia,
  downloadMedia,
  getContextInfo,
  extractMedia,
} from '../../lib/utils.js';
import { writeExif } from '../../lib/exif.js';
import {
  audioDariStiker,
  bersihkanAudio,
  kirimStikerSuara,
  unggahUlangAudio,
} from '../../lib/stickerSuara.js';
import { cariStikerSuara } from '../../lib/stickerAudioCache.js';

import { Sticker, StickerTypes } from 'wa-sticker-formatter';

const webp = webpmux.default || webpmux;

/**
 * audioMessage milik stiker yang dibalas, bila stiker itu STIKER SUARA
 * (hasil .sa atau dari orang lain). null untuk stiker/gambar biasa.
 *
 * Dicari di quotedMessage dulu; kalau WhatsApp membuang audioMessage dari
 * quote, dicari di ingatan bot lewat ID pesan yang dibalas
 * (lib/stickerAudioCache.js — diisi saat bot mengirim stiker suara, dan oleh
 * handle/stickeraudio_ingat.js untuk stiker suara yang masuk).
 */
function audioStikerDibalas(message, remoteJid) {
  const ctx = getContextInfo(message);
  const media = extractMedia(ctx?.quotedMessage ?? {});
  if (media?.mediaType !== 'sticker') return { audio: null, sumber: 'bukan stiker' };

  // ID & pengirim stiker aslinya — dibutuhkan untuk meminta ulang media yang
  // sudah kedaluwarsa saat audionya diunduh.
  const asal = { stanzaId: ctx?.stanzaId, participant: ctx?.participant };

  const dariQuote = audioDariStiker(media.mediaMessage);
  if (dariQuote) return { audio: dariQuote, sumber: 'quote', asal };

  const dariIngatan = bersihkanAudio(cariStikerSuara(remoteJid, ctx?.stanzaId));
  if (dariIngatan) return { audio: dariIngatan, sumber: 'ingatan bot', asal };

  const adaField = media.mediaMessage?.audioMessage ? 'ada tapi tanpa kunci' : 'tidak ada';
  return { audio: null, sumber: `audioMessage di quote ${adaField}, tidak ada di ingatan` };
}

/**
 * Ganti paket stiker suara TANPA menghilangkan suaranya.
 *
 * Jalur biasa (wa-sticker-formatter -> `{ sticker }`) membuat stiker baru
 * tanpa audio, jadi suaranya hilang. Di sini webp-nya hanya diganti EXIF
 * paketnya (frame animasi tidak di-encode ulang), lalu audio stiker aslinya
 * (sudah diunggah ulang oleh pemanggil, lihat handle) ditempel lagi.
 */
async function wmStikerSuara(sock, remoteJid, mediaPath, audioMessage, packname, author) {
  const buffer = fs.readFileSync(mediaPath);

  let isAnimated = false;
  try {
    const img = new webp.Image();
    await img.load(buffer);
    isAnimated = !!img.hasAnim;
  } catch {
    // bukan webp yang terbaca -> anggap stiker diam
  }

  const tmp = await writeExif({ mimetype: 'image/webp', data: buffer }, { packname, author });
  try {
    await kirimStikerSuara(sock, remoteJid, {
      webpBuffer: tmp ? fs.readFileSync(tmp) : buffer,
      isAnimated,
      audioMessage,
    });
  } finally {
    if (tmp) fs.rmSync(tmp, { force: true });
  }
}

async function sendError(sock, remoteJid, message, errorMessage) {
  await sock.sendMessage(remoteJid, { text: errorMessage }, { quoted: message });
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command, isQuoted, type } = messageInfo;
  const mediaType = isQuoted ? isQuoted.type : type;
  let mediaPath;

  try {
    const [packname = '', author = ''] = content.split('|').map((s) => s.trim());

    // Validasi tipe media
    if (!['image', 'sticker'].includes(mediaType)) {
      return sendError(
        sock,
        remoteJid,
        message,
        `⚠️ _Kirim/Balas gambar/stiker dengan caption *${prefix + command}*_`,
      );
    }

    // Validasi konten input
    if (!content.trim()) {
      return sendError(
        sock,
        remoteJid,
        message,
        `_Contoh: *wm az creative*_

_Contoh 1: wm nama_
_Contoh 2: wm youtube | creative_`,
      );
    }

    // Unduh media
    const namaFile = isQuoted ? await downloadQuotedMedia(message) : await downloadMedia(message);
    mediaPath = namaFile ? `./tmp/${namaFile}` : null;

    if (!mediaPath || !fs.existsSync(mediaPath)) {
      throw new Error('File media tidak ditemukan setelah diunduh.');
    }

    // Stiker suara: ganti paketnya saja, suaranya dipertahankan.
    if (mediaType === 'sticker' && isQuoted && typeof sock.waUploadToServer === 'function') {
      const { audio, sumber, asal } = audioStikerDibalas(message, remoteJid);
      console.log(`[WM] stiker dibalas: suara ${audio ? `DITEMUKAN (${sumber})` : `tidak ada — ${sumber}`}`);

      // Suara gagal diambil (mis. media lama sudah kedaluwarsa) -> JANGAN
      // gagal total: lanjut ke jalur biasa, stiker tetap diganti wm-nya
      // walau tanpa suara — sama seperti perilaku .wm sebelum ada .sa.
      let audioBaru = null;
      if (audio) {
        try {
          audioBaru = await unggahUlangAudio(sock, remoteJid, audio, asal);
        } catch (error) {
          console.warn(`[WM] suara stiker gagal diambil, dibuat tanpa suara: ${error?.message || error}`);
        }
      }
      if (audioBaru) {
        await wmStikerSuara(sock, remoteJid, mediaPath, audioBaru, packname, author);
        return;
      }
    }

    // Buat stiker dengan watermark
    const sticker = new Sticker(mediaPath, {
      pack: packname,
      author: author,
      type: StickerTypes.FULL,
      quality: 50,
    });

    const buffer = await sticker.toBuffer();
    await sock.sendMessage(remoteJid, { sticker: buffer });
  } catch (error) {
    await sendError(
      sock,
      remoteJid,
      message,
      `Maaf, terjadi kesalahan saat memproses permintaan Anda. Coba lagi nanti.\n\nError: ${error.message}`,
    );
  } finally {
    // Dulu berkas unduhan tidak pernah dihapus dan menumpuk di tmp/.
    if (mediaPath) fs.rmSync(mediaPath, { force: true });
  }
}

export default {
  handle,
  Commands: ['wm'],
  OnlyPremium: false,
  OnlyOwner: false,
};
