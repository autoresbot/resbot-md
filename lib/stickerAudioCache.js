/**
 * Ingatan singkat untuk `.sa`: VN/audio mana yang membalas stiker/gambar apa.
 *
 * Skenario: A kirim stiker -> B membalas stiker itu dengan VN -> seseorang
 * membalas VN itu dengan `.sa`. Pesan `.sa` hanya membawa VN-nya (sebagai
 * quotedMessage); stiker yang dibalas VN itu ada "satu tingkat lebih dalam".
 *
 * WhatsApp kadang menyertakan tingkat itu (quotedMessage.audioMessage.
 * contextInfo.quotedMessage), kadang tidak. Store pesan zapo juga dimatikan
 * (lib/zapo/store.js, `messages: 'none'`), jadi VN lama tidak bisa dicari
 * ulang lewat ID-nya. Karena itu handler handle/stickeraudio_ingat.js
 * mencatat setiap VN yang membalas stiker/gambar di sini, dan plugin .sa
 * membacanya sebagai cadangan.
 *
 * Yang disimpan hanya proto stiker/gambar yang dibalas (berisi directPath +
 * mediaKey untuk diunduh ulang), bukan medianya — jadi ringan.
 */

import { createBoundedMap } from './boundedStore.js';
import { extractMedia, getContextInfo } from './utils.js';

/** Jenis media yang bisa dijadikan stiker bersuara (sumber visual). */
const JENIS_VISUAL = new Set(['sticker', 'image', 'video']);

const ingatan = createBoundedMap({ max: 1000, ttl: 6 * 60 * 60 * 1000 });

const kunci = (remoteJid, id) => `${remoteJid}|${id}`;

/**
 * Ambil stiker/gambar yang dibalas oleh sebuah pesan audio.
 * @param {object} audioContent isi pesan audio (bentuk `{ audioMessage }`)
 * @returns {{ quoted: object, stanzaId?: string, participant?: string } | null}
 */
function visualDibalasAudio(audioContent) {
  const media = extractMedia(audioContent);
  if (media?.mediaType !== 'audio') return null;

  const ctx = media.mediaMessage?.contextInfo ?? getContextInfo(audioContent);
  const quoted = ctx?.quotedMessage;
  if (!quoted) return null;

  const visual = extractMedia(quoted);
  if (!visual || !JENIS_VISUAL.has(visual.mediaType)) return null;
  // Tanpa kunci + lokasi CDN, media tidak bisa diunduh ulang — lebih baik
  // dianggap "tidak ada" supaya .sa jatuh ke pilihan dua langkah, daripada
  // memilih visual ini lalu gagal saat diunduh.
  const m = visual.mediaMessage;
  if (!m?.mediaKey || !(m.directPath || m.url)) return null;

  return { quoted, stanzaId: ctx.stanzaId, participant: ctx.participant };
}

/** Dipanggil handler untuk SETIAP pesan masuk. */
function ingatVisualDibalasVN(remoteJid, message) {
  const id = message?.key?.id;
  if (!remoteJid || !id) return;
  const hasil = visualDibalasAudio(message);
  if (hasil) ingatan.set(kunci(remoteJid, id), hasil);
}

/** Cari dari ingatan, berdasarkan ID pesan VN-nya. */
function cariVisualDibalasVN(remoteJid, idVN) {
  if (!remoteJid || !idVN) return null;
  return ingatan.get(kunci(remoteJid, idVN)) ?? null;
}

/* ------------------------------------------------------------------------
 * Pilihan dua langkah: stiker/gambar dan VN/audio yang sudah ada di chat,
 * tapi TIDAK saling membalas. User membalas salah satunya dengan `.sa`
 * (dicatat di sini), lalu membalas yang lain dengan `.sa` -> digabung.
 * Satu pilihan per user per chat; kedaluwarsa setelah MASA_PILIHAN.
 * ---------------------------------------------------------------------- */

const MASA_PILIHAN = 60 * 1000;
const pilihan = createBoundedMap({ max: 500, ttl: MASA_PILIHAN });

/**
 * @param {'visual'|'audio'} jenis
 * @param {{ quoted: object, stanzaId?: string, participant?: string }} media
 */
function simpanPilihan(remoteJid, user, jenis, media) {
  pilihan.set(kunci(remoteJid, user), { jenis, ...media });
}

function ambilPilihan(remoteJid, user) {
  return pilihan.get(kunci(remoteJid, user)) ?? null;
}

function hapusPilihan(remoteJid, user) {
  pilihan.delete(kunci(remoteJid, user));
}

/* ------------------------------------------------------------------------
 * Stiker suara yang pernah lewat (dikirim bot sendiri lewat .sa/.wm, atau
 * masuk dari orang lain): ID pesan -> audioMessage-nya.
 *
 * Dipakai `.wm`: saat stiker suara di-quote, WhatsApp bisa membuang
 * `audioMessage` dari quotedMessage, sehingga .wm tidak tahu stiker itu
 * bersuara dan suaranya hilang. Dengan ingatan ini audionya tetap ditemukan
 * lewat ID pesan yang dibalas (contextInfo.stanzaId).
 * ---------------------------------------------------------------------- */

const stikerSuara = createBoundedMap({ max: 1000, ttl: 6 * 60 * 60 * 1000 });

function ingatStikerSuara(remoteJid, id, audioMessage) {
  if (!remoteJid || !id || !audioMessage) return;
  stikerSuara.set(kunci(remoteJid, id), audioMessage);
}

function cariStikerSuara(remoteJid, id) {
  if (!remoteJid || !id) return null;
  return stikerSuara.get(kunci(remoteJid, id)) ?? null;
}

/** Dipanggil handler: catat stiker suara yang masuk. */
function ingatStikerSuaraMasuk(remoteJid, message) {
  const media = extractMedia(message);
  if (media?.mediaType !== 'sticker') return;
  const audio = media.mediaMessage?.audioMessage;
  if (audio?.mediaKey) ingatStikerSuara(remoteJid, message?.key?.id, audio);
}

export {
  ingatStikerSuara,
  cariStikerSuara,
  ingatStikerSuaraMasuk,
  visualDibalasAudio,
  ingatVisualDibalasVN,
  cariVisualDibalasVN,
  simpanPilihan,
  ambilPilihan,
  hapusPilihan,
  MASA_PILIHAN,
};
