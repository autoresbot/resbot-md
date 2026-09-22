/**
 * stringsForm.js - Edit pesan bot di strings.js lewat form per kategori.
 *
 * Kategori & field dibaca LANGSUNG dari objek `const mess = { ... }`, jadi
 * pesan baru yang ditambahkan developer otomatis muncul di form tanpa perlu
 * mengubah dashboard. Saat menyimpan hanya literal teks pesan yang diganti;
 * komentar & bagian lain strings.js tetap utuh.
 */

import { evalLiteral, scanLiteralEnd, quote } from './configForm.js';

const MAX_LENGTH = 4000;

const CATEGORY_INFO = {
  general: { title: 'Umum', icon: 'chat' },
  action: { title: 'Aksi Grup', icon: 'group' },
  handler: { title: 'Notifikasi & Proteksi', icon: 'shield' },
  game: { title: 'Game', icon: 'puzzle' },
  game_handler: { title: 'Hasil Game', icon: 'crown' },
};

const LABELS = {
  isOwner: 'Khusus Owner',
  isPremium: 'Khusus Premium',
  isAdmin: 'Khusus Admin',
  isGroup: 'Khusus Grup',
  limit: 'Limit Habis',
  success: 'Berhasil',
  isBlocked: 'User Diblokir',
  isBaned: 'User Di-ban di Grup',
  fiturBlocked: 'Fitur Di-ban di Grup',
  isPlaying: 'Game Sedang Berlangsung',
  isStop: 'Game Dimatikan',
  grub_open: 'Grup Dibuka',
  grub_close: 'Grup Ditutup',
  user_kick: 'Kick Peserta',
  mute: 'Mute Grup',
  unmute: 'Unmute Grup',
  resetgc: 'Reset Link Grup',
  badword_warning: 'Peringatan Badword',
  badword_block: 'Blokir Badword',
  antiedit: 'Anti Edit',
  antidelete: 'Anti Delete',
  antispamchat: 'Peringatan Spam',
  antispamchat2: 'Blokir Spam',
  antivirtex: 'Anti Virtex',
  antitagsw: 'Anti Tag Status',
  antibot: 'Anti Bot',
  afk: 'Tag User AFK',
  afk_message: 'Kembali dari AFK',
  sewa_notif: 'Pengingat Sewa',
  sewa_out: 'Sewa Habis',
  notifultah: 'Ucapan Ulang Tahun',
  menyerah: 'Menyerah',
  waktu_habis: 'Waktu Habis',
};

class StringsFormError extends Error {}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const humanize = (key) =>
  key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** Rentang objek `{ ... }` milik `const mess`. */
function locateMess(source) {
  const match = /^const\s+mess\s*=\s*/m.exec(source);
  if (!match || source[match.index + match[0].length] !== '{') {
    throw new StringsFormError('Objek "const mess = {" tidak ditemukan di strings.js.');
  }
  const start = match.index + match[0].length;
  return { start, end: scanLiteralEnd(source, start) };
}

/** Cari properti `key:` di dalam rentang [from, to) lalu kembalikan rentang nilainya. */
function locateProp(source, from, to, key) {
  const re = new RegExp(`^[ \\t]*['"]?${escapeRe(key)}['"]?\\s*:\\s*`, 'm');
  const match = re.exec(source.slice(from, to));
  if (!match) return null;
  const start = from + match.index + match[0].length;
  return { start, end: scanLiteralEnd(source, start) };
}

function locateMessage(source, category, key) {
  const mess = locateMess(source);
  const cat = locateProp(source, mess.start + 1, mess.end, category);
  if (!cat || source[cat.start] !== '{') return null;
  return locateProp(source, cat.start + 1, cat.end, key);
}

function readStringsForm(source) {
  const mess = locateMess(source);
  const data = evalLiteral(source.slice(mess.start, mess.end));
  if (!data || typeof data !== 'object') {
    throw new StringsFormError('Isi strings.js tidak bisa dibaca.');
  }

  return Object.entries(data)
    .filter(([, group]) => group && typeof group === 'object' && !Array.isArray(group))
    .map(([id, group]) => ({
      id,
      title: CATEGORY_INFO[id]?.title || humanize(id),
      icon: CATEGORY_INFO[id]?.icon || 'chat',
      fields: Object.entries(group)
        .filter(([, value]) => typeof value === 'string')
        .map(([key, value]) => ({
          key: `${id}.${key}`,
          label: LABELS[key] || humanize(key),
          name: key,
          value,
          // Variabel yang dipakai pesan aslinya, ditampilkan sebagai petunjuk.
          variables: [...new Set(value.match(/@[a-zA-Z_]+/g) || [])],
        })),
    }))
    .filter((cat) => cat.fields.length)
    // Kategori yang dikenal tampil lebih dulu (Umum di depan), sisanya menyusul.
    .sort((a, b) => rank(a.id) - rank(b.id));
}

const ORDER = Object.keys(CATEGORY_INFO);
const rank = (id) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);

/** values: { 'kategori.key': 'teks baru' } */
function applyStringsForm(source, values) {
  const known = new Set(readStringsForm(source).flatMap((c) => c.fields.map((f) => f.key)));
  let out = source;
  const changed = [];

  for (const [fullKey, value] of Object.entries(values || {})) {
    if (!known.has(fullKey)) throw new StringsFormError(`Pesan '${fullKey}' tidak dikenal.`);
    if (typeof value !== 'string') throw new StringsFormError(`Pesan '${fullKey}' harus berupa teks.`);
    if (value.length > MAX_LENGTH) throw new StringsFormError(`Pesan '${fullKey}' terlalu panjang.`);

    const [category, key] = fullKey.split('.');
    const loc = locateMessage(out, category, key);
    if (!loc) throw new StringsFormError(`Pesan '${fullKey}' tidak ditemukan di strings.js.`);

    const next = out.slice(0, loc.start) + quote(value.replace(/\r\n/g, '\n')) + out.slice(loc.end);
    if (next !== out) changed.push(fullKey);
    out = next;
  }
  return { source: out, changed };
}

export { StringsFormError, readStringsForm, applyStringsForm };
