/**
 * Penerjemah konten pesan: bentuk Baileys -> bentuk zapo-js.
 *
 * Baileys memakai "shape-by-key" (`{ image: ..., caption: ... }`), zapo memakai
 * discriminated union (`{ type: 'image', media: ..., caption: ... }`). Karena
 * ada 1200+ pemanggilan `sock.sendMessage` di plugins, penerjemahan dilakukan
 * di sini sekali saja alih-alih mengubah semua pemanggil.
 */

import { Readable } from 'stream';
import FileType from 'file-type';

/** Field media Baileys -> `type` zapo. */
const MEDIA_KEYS = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  document: 'document',
  sticker: 'sticker',
  ptv: 'ptv',
};

/**
 * Field yang BUKAN bagian dari media, jadi tidak boleh ikut disalin mentah ke
 * konten zapo (mereka sudah punya tempat sendiri di `options`).
 */
const OPTION_ONLY_KEYS = new Set([
  'mentions',
  'contextInfo',
  'quoted',
  'ephemeralExpiration',
  'viewOnce',
  'linkPreview',
]);

const isBuffer = (v) => typeof Buffer !== 'undefined' && Buffer.isBuffer(v);
const isStream = (v) => v instanceof Readable;

/**
 * Konten yang sudah berbentuk `Proto.IMessage` mentah (mis. hasil
 * `generateWAMessageFromContent`). zapo menerimanya apa adanya lewat
 * `client.message.send`, jadi cukup diteruskan.
 *
 * Pemeriksaannya SENGAJA longgar. Versi sebelumnya menebak lewat pola nama
 * field (berakhiran "Message"), dan itu meleset untuk field yang tidak
 * mengikuti pola — `.swgc` gagal karena `groupStatusMessageV2` (berakhiran
 * "V2") dan `messageContextInfo` (berakhiran "Info"). Daftar field proto juga
 * tidak bisa diintrospeksi dari `zapo.proto` (encoder-nya ditulis tangan,
 * tanpa metadata protobufjs).
 *
 * Karena fungsi ini dipanggil PALING AKHIR — setelah semua bentuk Baileys
 * dikenali — apa pun yang sampai sini memang bukan bentuk Baileys. Jadi lebih
 * baik diteruskan ke zapo, yang punya validasi proto sungguhan, daripada
 * ditolak oleh tebakan pola di sini.
 */
export function isRawProtoMessage(content) {
  return !!content && typeof content === 'object' && Object.keys(content).length > 0;
}

/**
 * Ubah sumber media Baileys menjadi sumber yang dimengerti zapo.
 *
 * Baileys menerima `{ url }` untuk path lokal MAUPUN URL http. zapo hanya
 * membaca string sebagai path file, jadi URL http diunduh lebih dulu.
 */
async function resolveMedia(value) {
  if (value == null) return value;
  if (isBuffer(value) || value instanceof Uint8Array || isStream(value)) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);

  if (typeof value === 'string') return fromUrlOrPath(value);

  if (typeof value === 'object') {
    if (value.url) return fromUrlOrPath(value.url);
    if (value.stream) return value.stream;
    if (value.buffer) return value.buffer;
  }
  return value;
}

async function fromUrlOrPath(str) {
  if (!/^https?:\/\//i.test(str)) return str; // path lokal, biarkan zapo yang buka
  const res = await fetch(str);
  if (!res.ok) throw new Error(`Gagal mengunduh media (${res.status}): ${str}`);
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Mimetype cadangan per jenis media, dipakai kalau deteksi gagal.
 * Voice note ditangani terpisah di `resolveMimetype` karena WhatsApp menuntut
 * ogg/opus, bukan mimetype audio apa adanya.
 */
const FALLBACK_MIMETYPES = {
  image: 'image/jpeg',
  video: 'video/mp4',
  ptv: 'video/mp4',
  audio: 'audio/mpeg',
  sticker: 'image/webp',
  document: 'application/octet-stream',
};

/**
 * Tentukan mimetype untuk konten media.
 *
 * Baileys mendeteksinya sendiri; zapo mewajibkan mimetype eksplisit dan
 * melempar "mimetype is required for image messages" kalau kosong. Karena
 * banyak plugin mengirim media tanpa menyebut mimetype, deteksinya dipusatkan
 * di sini alih-alih menambal tiap plugin.
 */
async function resolveMimetype(media, type, content) {
  if (content.mimetype) return content.mimetype;

  // Voice note wajib ogg/opus supaya tampil sebagai rekaman suara, bukan file.
  if (type === 'audio' && content.ptt) return 'audio/ogg; codecs=opus';

  try {
    if (isBuffer(media) || media instanceof Uint8Array) {
      const detected = await FileType.fromBuffer(media);
      if (detected?.mime) return detected.mime;
    } else if (typeof media === 'string' && !/^https?:\/\//i.test(media)) {
      const detected = await FileType.fromFile(media);
      if (detected?.mime) return detected.mime;
    }
    // Stream tidak bisa diintip tanpa mengonsumsinya -> langsung ke fallback.
  } catch {
    // Deteksi gagal (file tidak terbaca / format tak dikenal) -> fallback.
  }

  return FALLBACK_MIMETYPES[type] ?? 'application/octet-stream';
}

/** Salin field media Baileys yang namanya sama persis di proto zapo. */
function copyMediaExtras(source, target) {
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    if (OPTION_ONLY_KEYS.has(key)) continue;
    if (key in MEDIA_KEYS) continue;
    if (key === 'ptt' || key === 'gifPlayback') {
      // nama field proto-nya sama, cukup diteruskan
      target[key] = value;
      continue;
    }
    target[key] = value;
  }
}

/**
 * JID dianggap sah kalau punya bagian user DAN domain, mis.
 * `628xx@s.whatsapp.net` atau `2319xx@lid`.
 *
 * Mention di project ini dipungut dari teks dengan regex, dan pola lama
 * (`@(\d{0,16})`) membolehkan NOL digit — sebuah `@` polos di tengah kalimat
 * menghasilkan JID tanpa user seperti `"@lid"`. Baileys memaafkannya, zapo
 * tidak: satu mention rusak membuat seluruh pesan gagal terkirim.
 */
function isJidValid(jid) {
  return typeof jid === 'string' && /^[^@\s]+@[\w.-]+$/.test(jid);
}

/**
 * Bangun `options` zapo dari argumen ketiga `sendMessage` + field yang di
 * Baileys menempel pada konten (`mentions`, `contextInfo`).
 */
export function buildSendOptions(content, baileysOptions = {}) {
  const options = {};

  const mentions = content?.mentions ?? content?.contextInfo?.mentionedJid;
  const mentionsValid = Array.isArray(mentions) ? mentions.filter(isJidValid) : [];
  if (mentionsValid.length) options.mentions = mentionsValid;

  const quoted = baileysOptions.quoted;
  if (quoted?.key?.id) {
    options.quote = {
      id: quoted.key.id,
      participant: quoted.key.participant ?? undefined,
      remoteJid: quoted.key.remoteJid ?? undefined,
      message: quoted.message ?? undefined,
    };
  } else if (quoted?.id) {
    options.quote = quoted;
  }

  const rawContext = content?.contextInfo;
  if (rawContext && typeof rawContext === 'object') {
    // `mentionedJid` di contextInfo mentah ikut dibersihkan — kalau tidak,
    // JID rusak tetap lolos lewat jalur ini meski `options.mentions` sudah
    // disaring.
    const raw = Array.isArray(rawContext.mentionedJid)
      ? { ...rawContext, mentionedJid: rawContext.mentionedJid.filter(isJidValid) }
      : rawContext;

    options.contextInfo = { raw };
  }

  const expiration = baileysOptions.ephemeralExpiration ?? content?.ephemeralExpiration;
  if (expiration) options.expirationSeconds = Number(expiration);

  if (baileysOptions.messageId) options.id = baileysOptions.messageId;

  return options;
}

/**
 * Terjemahkan konten Baileys -> konten zapo.
 * Mengembalikan objek yang siap dipakai `client.message.send`.
 */
export async function toZapoContent(content) {
  if (typeof content === 'string') return { type: 'text', text: content };
  if (!content || typeof content !== 'object') {
    throw new Error('Konten pesan tidak valid');
  }

  // --- reaksi ---
  if (content.react) {
    return {
      type: 'reaction',
      emoji: content.react.text ?? '',
      target: content.react.key,
    };
  }

  // --- hapus pesan ---
  if (content.delete) {
    return { type: 'revoke', target: content.delete };
  }

  // --- polling ---
  if (content.poll) {
    return {
      type: 'poll',
      name: content.poll.name,
      options: content.poll.values ?? content.poll.options ?? [],
      selectableCount: content.poll.selectableCount ?? 1,
    };
  }

  // --- pin / unpin ---
  if (content.pin) {
    return {
      type: content.pin.type === 2 || content.pin.unpin ? 'unpin' : 'pin',
      target: content.pin.key ?? content.pin,
      durationSecs: content.pin.time ?? undefined,
    };
  }

  // --- lokasi & kontak: zapo belum punya builder, kirim sebagai proto mentah ---
  if (content.location) {
    return { locationMessage: content.location };
  }
  if (content.contacts) {
    const list = content.contacts.contacts ?? [];
    if (list.length === 1) return { contactMessage: list[0] };
    return {
      contactsArrayMessage: {
        displayName: content.contacts.displayName ?? `${list.length} contacts`,
        contacts: list,
      },
    };
  }

  // --- media ---
  for (const [key, type] of Object.entries(MEDIA_KEYS)) {
    if (content[key] === undefined) continue;

    const out = { type, media: await resolveMedia(content[key]) };
    copyMediaExtras(content, out);
    delete out[key];

    // zapo menolak media tanpa mimetype, jadi selalu diisi.
    out.mimetype = await resolveMimetype(out.media, type, content);

    // Baileys menandai voice note dengan `ptt: true` pada audio; zapo memakai
    // field proto yang sama, jadi tidak perlu dipetakan ulang.
    return out;
  }

  // --- teks ---
  if (typeof content.text === 'string') {
    const out = { type: 'text', text: content.text };
    if (content.linkPreview === false) out.linkPreview = false;
    return out;
  }
  if (typeof content.caption === 'string') {
    return { type: 'text', text: content.caption };
  }

  // --- proto mentah (interactiveMessage, buttonsMessage, dll) ---
  if (isRawProtoMessage(content)) return content;

  throw new Error(`Bentuk konten tidak dikenali: ${Object.keys(content).join(', ')}`);
}
