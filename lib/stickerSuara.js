/**
 * Helper bersama untuk STIKER SUARA (sound sticker WhatsApp), dipakai oleh
 * `.sa` (plugins/MAKER/stickeraudio.js) dan `.wm` (plugins/MAKER/wm.js).
 *
 * Bentuk pesannya: `{ stickerMessage: { ...media webp, audioMessage: {...} } }`.
 * Sudah diuji di WhatsApp sungguhan (2026-11-25): bentuk ini berhasil.
 * Pembungkus `{ audioStickerMessage: { message: { stickerMessage } } }` justru
 * membuat bot hanya menampilkan ⏰ tanpa hasil maupun error — JANGAN dipakai.
 *
 * zapo-js (>= 1.12.1) belum punya builder khusus, jadi medianya diunggah
 * manual lewat `sock.waUploadToServer` (= client.message.upload) lalu dikirim
 * sebagai proto mentah — lib/zapo/content.js meneruskannya apa adanya.
 */

import fs from 'fs';
import path from 'path';
import webpmux from 'node-webpmux';

import { downloadQuotedMedia } from './utils.js';
import { ingatStikerSuara } from './stickerAudioCache.js';

const webp = webpmux.default || webpmux;

export const MIME_AUDIO_STIKER = 'audio/ogg; codecs=opus';

/** Field hasil upload zapo -> field media di proto. */
export function fieldMedia(up, mimetype) {
  return {
    url: up.url,
    directPath: up.directPath,
    mediaKey: up.mediaKey,
    fileSha256: up.fileSha256,
    fileEncSha256: up.fileEncSha256,
    fileLength: up.fileLength,
    mediaKeyTimestamp: up.mediaKeyTimestamp,
    mimetype,
  };
}

/**
 * Ambil audioMessage dari stiker suara yang SUDAH ADA.
 * `contextInfo` dibuang supaya balasan/mention lama tidak ikut terbawa.
 *
 * @param {object} stickerMessage proto stickerMessage
 * @returns {object|null} audioMessage, atau null bila bukan stiker suara /
 *   datanya tidak lengkap untuk diunduh
 */
export function audioDariStiker(stickerMessage) {
  return bersihkanAudio(stickerMessage?.audioMessage);
}

/** audioMessage yang bisa diunduh (punya kunci + lokasi CDN), tanpa contextInfo. */
export function bersihkanAudio(audio) {
  if (!audio) return null;
  if (!audio.mediaKey || !(audio.directPath || audio.url)) return null;
  const { contextInfo: _buang, ...bersih } = audio;
  return bersih;
}

/**
 * Unduh audio dari stiker suara lama, lalu unggah ulang dengan kunci baru —
 * jalurnya sama dengan `.sa` (yang sudah terbukti bersuara di WhatsApp).
 *
 * Memakai ulang field CDN lama apa adanya ("seperti forward") ternyata
 * menghasilkan stiker TANPA suara saat diuji, jadi tidak dipakai lagi.
 *
 * `asal` = ID & pengirim pesan stiker aslinya. Dipakai downloadMediaToFile
 * untuk meminta WhatsApp mengunggah ulang media yang sudah kedaluwarsa
 * (requestMediaReupload) — dengan ID palsu permintaan itu pasti gagal.
 *
 * @param {{ stanzaId?: string, participant?: string }} [asal]
 * @returns {Promise<object>} audioMessage baru, siap ditempel ke stiker
 */
export async function unggahUlangAudio(sock, remoteJid, audioLama, asal = {}) {
  const namaFile = await downloadQuotedMedia({
    key: { remoteJid, id: asal.stanzaId },
    message: {
      extendedTextMessage: {
        text: '',
        contextInfo: {
          stanzaId: asal.stanzaId,
          participant: asal.participant,
          quotedMessage: { audioMessage: audioLama },
        },
      },
    },
  });
  const filePath = namaFile ? path.join('tmp', namaFile) : null;
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('Suara stiker tidak bisa diunduh.');
  }

  try {
    const buffer = fs.readFileSync(filePath);
    const mimetype = audioLama.mimetype || MIME_AUDIO_STIKER;
    const up = await sock.waUploadToServer(buffer, { type: 'audio', mimetype });
    return {
      ...fieldMedia(up, mimetype),
      seconds: audioLama.seconds ?? undefined,
      ptt: false,
      ...(up.streamingSidecar ? { streamingSidecar: up.streamingSidecar } : {}),
    };
  } finally {
    fs.rmSync(filePath, { force: true });
  }
}

/**
 * Ukuran asli webp. Stiker dari .sa selalu 512x512, tapi `.wm` meneruskan
 * stiker orang lain apa adanya — ukurannya bisa berbeda, dan metadata yang
 * salah membuat placeholder/aspect ratio di klien keliru.
 */
async function ukuranWebp(webpBuffer) {
  try {
    const img = new webp.Image();
    await img.load(webpBuffer);
    if (img.width > 0 && img.height > 0) return { width: img.width, height: img.height };
  } catch {
    // tidak terbaca -> pakai ukuran standar stiker
  }
  return { width: 512, height: 512 };
}

/**
 * Unggah webp stiker lalu kirim sebagai stiker suara.
 *
 * @param {object} sock
 * @param {string} remoteJid
 * @param {object} opsi
 * @param {Buffer} opsi.webpBuffer  webp stiker (sudah ber-EXIF paket)
 * @param {boolean} opsi.isAnimated
 * @param {object} opsi.audioMessage proto audioMessage (hasil upload / audioDariStiker)
 * @param {object} [opsi.quoted]     pesan yang dibalas
 * @param {(nama: string, ms: number|null, fn: Function) => Promise<any>} [opsi.langkah]
 *   pembungkus timeout + log (dipakai .sa); default langsung dijalankan
 */
export async function kirimStikerSuara(
  sock,
  remoteJid,
  { webpBuffer, isAnimated, audioMessage, quoted, langkah = (_n, _ms, fn) => fn() },
) {
  const upSticker = await langkah('upload stiker', 60_000, () =>
    sock.waUploadToServer(webpBuffer, { type: 'sticker', mimetype: 'image/webp' }),
  );

  const stickerMessage = {
    ...fieldMedia(upSticker, 'image/webp'),
    ...(await ukuranWebp(webpBuffer)),
    isAnimated: !!isAnimated,
    audioMessage,
  };

  // Pengiriman SENGAJA tanpa batas waktu (ms = null): kalau dibatalkan oleh
  // timeout, pesannya tetap bisa sampai belakangan — user melihat "gagal"
  // DAN stikernya. zapo sendiri sudah punya ack timeout.
  const hasil = await langkah('kirim stiker suara', null, () =>
    sock.sendMessage(remoteJid, { stickerMessage }, quoted ? { quoted } : {}),
  );

  // Ingat audionya, supaya `.wm` pada stiker ini tetap menemukan suaranya
  // walau WhatsApp membuang audioMessage dari quotedMessage.
  ingatStikerSuara(remoteJid, hasil?.key?.id, audioMessage);
  return hasil;
}
