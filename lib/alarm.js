/**
 * alarm.js - Pesan terjadwal harian per grup (.addalarm / .alarm / .delalarm)
 *
 * Alarm disimpan di tabel `alarms` (SQLite) dan dijadwalkan dengan
 * node-schedule memakai zona waktu Asia/Jakarta secara eksplisit, jadi jam
 * yang diketik admin adalah jam WIB apa pun zona waktu servernya.
 */

import schedule from 'node-schedule';
import { getDb, initDatabase } from './database.js';
import { getGroupMetadata } from './cache.js';
import { logWithTime } from './utils.js';
import { isAccGroup } from './accGroups.js';

initDatabase();

/** Zona waktu acuan semua alarm — sama dengan fitur terjadwal lain di bot. */
const ZONA_WAKTU = 'Asia/Jakarta';

/** Batas wajar supaya satu grup tidak memenuhi penjadwal. */
const MAKS_ALARM_PER_GRUP = 20;
const MAKS_PANJANG_PESAN = 2000;

/** Mode penandaan anggota saat alarm dikirim. */
const MODE_TAG = {
  none: 'tanpa tag',
  tagall: 'tag all (daftar terlihat)',
  hidetag: 'tag tersembunyi',
};

let stmtCache = {};

function getStmt(key, sql) {
  if (!stmtCache[key]) {
    stmtCache[key] = getDb().prepare(sql);
  }
  return stmtCache[key];
}

/* =========================
   PARSER FORMAT PERINTAH
========================= */

/**
 * Normalkan jam: "6:00", "06.00", "6.5" -> "06:00" / null bila tidak valid.
 */
function normalkanWaktu(teks) {
  if (typeof teks !== 'string') return null;
  const cocok = teks.trim().match(/^([01]?\d|2[0-3])[:.]([0-5]\d)$/);
  if (!cocok) return null;
  return `${cocok[1].padStart(2, '0')}:${cocok[2]}`;
}

/* -------------------------- HARI AKTIF -------------------------- */

/** Nomor hari mengikuti cron: 0 = Minggu ... 6 = Sabtu. */
const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const KATA_HARI = {
  minggu: 0, ahad: 0, min: 0, sunday: 0, sun: 0,
  senin: 1, sen: 1, monday: 1, mon: 1,
  selasa: 2, sel: 2, tuesday: 2, tue: 2,
  rabu: 3, rab: 3, wednesday: 3, wed: 3,
  kamis: 4, kam: 4, thursday: 4, thu: 4,
  jumat: 5, jum: 5, jumaat: 5, friday: 5, fri: 5,
  sabtu: 6, sab: 6, saturday: 6, sat: 6,
};

/** Kelompok hari yang sering dipakai. */
const KELOMPOK_HARI = {
  'setiap hari': [0, 1, 2, 3, 4, 5, 6],
  'tiap hari': [0, 1, 2, 3, 4, 5, 6],
  everyday: [0, 1, 2, 3, 4, 5, 6],
  'hari kerja': [1, 2, 3, 4, 5],
  weekday: [1, 2, 3, 4, 5],
  weekdays: [1, 2, 3, 4, 5],
  'akhir pekan': [6, 0],
  weekend: [6, 0],
};

/**
 * Baca teks hari: "jumat", "senin, kamis", "senin-jumat", "sabtu & minggu",
 * "hari kerja", "weekend", "hari jumat". Semua kata harus berupa hari —
 * kalau ada satu kata lain, teks itu BUKAN daftar hari (mis. isi pesan).
 *
 * @returns {number[]|null} nomor hari terurut, atau null bila bukan daftar hari
 */
function parseHari(teks) {
  if (typeof teks !== 'string') return null;
  let isi = teks
    .toLowerCase()
    .replace(/[’'`]/g, '') // jum'at -> jumat
    .replace(/\s+/g, ' ')
    .trim()
    // Frasa dua kata dijadikan satu token supaya bisa digabung, mis. "hari kerja, sabtu".
    .replace(/\b(setiap|tiap) hari\b/g, 'everyday')
    .replace(/\bhari kerja\b/g, 'weekday')
    .replace(/\bakhir pekan\b/g, 'weekend')
    // Awalan yang boleh ditulis: "hari jumat", "hari: senin, kamis", "setiap jumat".
    .replace(/^(hari|days?|setiap|tiap)\s*:?\s*/, '')
    .replace(/\s*(s\/d|sd|sampai|hingga|to|–|—)\s*/g, '-')
    .trim();
  if (!isi) return null;

  const hasil = new Set();
  const bagian = isi.split(/\s*(?:,|&|\+|\/|;|\bdan\b|\band\b|\s)\s*/).filter(Boolean);
  if (!bagian.length) return null;

  for (const kata of bagian) {
    const rentang = kata.match(/^([a-z]+)-([a-z]+)$/);
    if (rentang) {
      const awal = KATA_HARI[rentang[1]];
      const akhir = KATA_HARI[rentang[2]];
      if (awal === undefined || akhir === undefined) return null;
      // Rentang boleh melewati Minggu, mis. "jumat-senin" = Jum, Sab, Min, Sen.
      for (let h = awal; ; h = (h + 1) % 7) {
        hasil.add(h);
        if (h === akhir) break;
      }
      continue;
    }
    if (KELOMPOK_HARI[kata]) {
      KELOMPOK_HARI[kata].forEach((h) => hasil.add(h));
      continue;
    }
    const hari = KATA_HARI[kata];
    if (hari === undefined) return null;
    hasil.add(hari);
  }

  return [...hasil].sort((a, b) => a - b);
}

/** Simpan sebagai "1,3,5"; tujuh hari penuh disimpan kosong (= setiap hari). */
function hariKeTeks(daftar) {
  if (!Array.isArray(daftar) || !daftar.length || daftar.length >= 7) return '';
  return daftar.join(',');
}

/** Nomor hari dari kolom `days`. Kosong / rusak -> [] (= setiap hari). */
function hariDariTeks(teks) {
  if (!teks) return [];
  const daftar = String(teks)
    .split(',')
    .map(Number)
    .filter((h) => Number.isInteger(h) && h >= 0 && h <= 6);
  return [...new Set(daftar)].sort((a, b) => a - b);
}

/** Label yang dibaca manusia: "setiap hari", "Jumat", "Senin–Jumat", ... */
function labelHari(teks) {
  const daftar = hariDariTeks(teks);
  if (!daftar.length || daftar.length >= 7) return 'setiap hari';
  if (daftar.join(',') === '1,2,3,4,5') return 'Senin–Jumat';
  if (daftar.join(',') === '0,6') return 'Sabtu & Minggu';
  // Urutan tampil Senin dulu, Minggu terakhir (lebih lazim di Indonesia).
  const urut = [...daftar].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  return urut.map((h) => NAMA_HARI[h]).join(', ');
}

/**
 * Opsi tag yang dikenali. SENGAJA dibatasi daftar ini: `--` lain yang kebetulan
 * ada di dalam pesan tidak ikut terbuang dari isi pesannya.
 */
const POLA_OPSI = /--(tagall|tagsemua|tag|hidetag|sembunyi)\b/gi;

/** `--tag` diterima sebagai alias `--tagall` — itu yang paling sering diketik. */
function bacaMode(opsi) {
  const kata = opsi.join(' ').toLowerCase();
  if (/--(tagall|tagsemua|tag)\b/.test(kata)) return 'tagall';
  if (/--(hidetag|sembunyi)\b/.test(kata)) return 'hidetag';
  return 'none';
}

/**
 * Pecah argumen `.addalarm` menjadi bagian-bagiannya.
 *
 * Format: `nama | pesan | HH:MM | --tagall`
 *
 * Urutannya SENGAJA dibuat toleran, supaya admin tidak perlu menghafal posisi:
 *  - opsi dikenali dari awalan `--` di mana pun letaknya (menempel di jam,
 *    berdiri sendiri setelah `|`, atau di baris terpisah),
 *  - jam dikenali dari bentuknya, bukan dari urutannya,
 *  - potongan sisanya: yang pertama jadi nama, selebihnya digabung jadi pesan
 *    (jadi tanda `|` di dalam pesan tidak menghilangkan isinya).
 *
 * @returns {{ok: true, data: {name, message, time, tag}} | {ok: false, alasan: string}}
 */
function parseAlarm(teks) {
  if (typeof teks !== 'string' || !teks.trim()) {
    return { ok: false, alasan: 'kosong' };
  }

  const opsi = teks.match(POLA_OPSI) ?? [];
  const potongan = teks
    .replace(POLA_OPSI, ' ')
    .split('|')
    .map((bagian) => bagian.trim())
    .filter(Boolean);

  if (!potongan.length) return { ok: false, alasan: 'kosong' };

  const indeksWaktu = potongan.findIndex((bagian) => normalkanWaktu(bagian));
  if (indeksWaktu === -1) return { ok: false, alasan: 'waktu' };

  const time = normalkanWaktu(potongan[indeksWaktu]);
  potongan.splice(indeksWaktu, 1);

  const name = potongan.shift();
  if (!name) return { ok: false, alasan: 'nama' };

  // Hari aktif: potongan SETELAH nama yang seluruh isinya nama hari. Nama
  // alarm tidak ikut diperiksa (alarm boleh bernama "jumat"), dan potongan
  // terakhir yang cocok dipakai, supaya pesan yang kebetulan berupa satu kata
  // hari tetap ada selama masih ada potongan lain.
  let days = '';
  for (let i = potongan.length - 1; i >= 0; i--) {
    const hari = parseHari(potongan[i]);
    if (hari && potongan.length > 1) {
      days = hariKeTeks(hari);
      potongan.splice(i, 1);
      break;
    }
  }

  const pesan = potongan.join(' | ').trim();

  if (!pesan) return { ok: false, alasan: 'pesan' };
  if (pesan.length > MAKS_PANJANG_PESAN) return { ok: false, alasan: 'panjang' };

  return {
    ok: true,
    data: {
      name: name.slice(0, 40),
      message: pesan,
      time,
      tag: bacaMode(opsi),
      days,
    },
  };
}

/* =========================
   PENYIMPANAN
========================= */

function daftarAlarm(groupId) {
  return getStmt(
    'listByGroup',
    'SELECT * FROM alarms WHERE group_id = ? ORDER BY time ASC, id ASC',
  ).all(groupId);
}

function semuaAlarm() {
  return getStmt('listAll', 'SELECT * FROM alarms ORDER BY id ASC').all();
}

/**
 * Simpan alarm. Nama yang sudah ada di grup itu DIPERBARUI, bukan digandakan.
 *
 * @returns {{ok: true, diperbarui: boolean} | {ok: false, alasan: 'penuh'}}
 */
function simpanAlarm(groupId, { name, message, time, tag, days = '' }, createdBy = '') {
  const adaSebelumnya = getStmt(
    'findByName',
    'SELECT id FROM alarms WHERE group_id = ? AND LOWER(name) = LOWER(?)',
  ).get(groupId, name);

  if (!adaSebelumnya && daftarAlarm(groupId).length >= MAKS_ALARM_PER_GRUP) {
    return { ok: false, alasan: 'penuh' };
  }

  if (adaSebelumnya) {
    getStmt(
      'updateAlarm',
      'UPDATE alarms SET message = ?, time = ?, tag = ?, days = ?, created_by = ? WHERE id = ?',
    ).run(message, time, tag, days, createdBy, adaSebelumnya.id);
  } else {
    getStmt(
      'insertAlarm',
      'INSERT INTO alarms (group_id, name, message, time, tag, days, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(groupId, name, message, time, tag, days, createdBy);
  }

  return { ok: true, diperbarui: !!adaSebelumnya };
}

/**
 * Hapus alarm berdasarkan nama, nomor urut di `.alarm`, atau `all`.
 *
 * @returns {{terhapus: number, nama: string[]}}
 */
function hapusAlarm(groupId, kunci) {
  const daftar = daftarAlarm(groupId);
  if (!daftar.length) return { terhapus: 0, nama: [] };

  const target = String(kunci ?? '').trim();

  if (target.toLowerCase() === 'all' || target.toLowerCase() === 'semua') {
    getStmt('deleteByGroup', 'DELETE FROM alarms WHERE group_id = ?').run(groupId);
    return { terhapus: daftar.length, nama: daftar.map((a) => a.name) };
  }

  const nomor = Number(target);
  const pilihan =
    Number.isInteger(nomor) && nomor >= 1 && nomor <= daftar.length
      ? daftar[nomor - 1]
      : daftar.find((a) => a.name.toLowerCase() === target.toLowerCase());

  if (!pilihan) return { terhapus: 0, nama: [] };

  getStmt('deleteById', 'DELETE FROM alarms WHERE id = ?').run(pilihan.id);
  return { terhapus: 1, nama: [pilihan.name] };
}

/* =========================
   PENJADWALAN
========================= */

/** Job milik modul ini saja, supaya bisa dibatalkan tanpa menyentuh job lain. */
const jobAlarm = new Map();

const namaJob = (alarm) => `alarm-${alarm.id}`;

async function kirimAlarm(sock, alarm) {
  const { group_id: groupId, message, tag, name } = alarm;

  // Grup yang belum di-.acc: alarm tetap tersimpan tapi tidak dikirim.
  if (!isAccGroup(groupId)) return;

  try {
    if (tag === 'none') {
      await sock.sendMessage(groupId, { text: message });
      return;
    }

    const metadata = await getGroupMetadata(sock, groupId);
    const participants = metadata?.participants ?? [];
    const mentions = participants.map((p) => p.id).filter(Boolean);

    if (!mentions.length) {
      // Metadata gagal diambil — pesannya tetap harus sampai, cuma tanpa tag.
      await sock.sendMessage(groupId, { text: message });
      return;
    }

    const teks =
      tag === 'tagall'
        ? `${message}\n\n${mentions.map((jid) => `⭔ @${jid.split('@')[0]}`).join('\n')}`
        : message;

    await sock.sendMessage(groupId, { text: teks, mentions });
  } catch (error) {
    logWithTime('Alarm', `Gagal mengirim alarm "${name}" ke ${groupId}: ${error?.message || error}`);
  }
}

function batalkanSemuaJob() {
  for (const job of jobAlarm.values()) job.cancel();
  jobAlarm.clear();
}

/**
 * Hapus SELURUH alarm di semua grup, dipakai oleh `.reset`.
 *
 * Job penjadwalnya ikut dibatalkan di sini, tidak cuma barisnya yang dihapus:
 * kalau hanya tabelnya yang dikosongkan, alarm lama tetap berbunyi sampai bot
 * direstart — dan tetap berbunyi selamanya bila scheduled task dimatikan di
 * config, karena updateSocket() berhenti lebih awal sehingga syncAlarm() tidak
 * pernah dipanggil.
 *
 * @returns {number} jumlah alarm yang dihapus
 */
function resetAlarm() {
  try {
    const jumlah = semuaAlarm().length;
    getStmt('deleteAllAlarms', 'DELETE FROM alarms').run();
    batalkanSemuaJob();
    console.log('🔄 Database alarm telah di-reset');
    return jumlah;
  } catch (error) {
    console.error('❌ Gagal me-reset database alarm:', error);
    return 0;
  }
}

/**
 * Daftarkan ulang SEMUA alarm ke penjadwal.
 *
 * Aman dipanggil berkali-kali: job lama milik modul ini dibatalkan lebih dulu.
 * Dipanggil saat koneksi terbuka DAN setiap kali daftar alarm berubah —
 * juga dari `updateSocket()` di scheduled.js, yang membatalkan seluruh job
 * (termasuk milik alarm) sebelum menjadwalkan ulang miliknya sendiri.
 */
function syncAlarm(sock) {
  batalkanSemuaJob();
  if (!sock) return 0;

  let jumlah = 0;
  for (const alarm of semuaAlarm()) {
    const [jam, menit] = alarm.time.split(':').map(Number);
    if (Number.isNaN(jam) || Number.isNaN(menit)) {
      logWithTime('Alarm', `Jam tidak valid pada alarm "${alarm.name}": ${alarm.time}`);
      continue;
    }

    // tz diserahkan ke node-schedule: jam yang disimpan selalu WIB, tidak
    // peduli zona waktu server (panel sering UTC). Hari juga dihitung WIB.
    const hari = hariDariTeks(alarm.days);
    const kolomHari = hari.length && hari.length < 7 ? hari.join(',') : '*';
    const job = schedule.scheduleJob(
      namaJob(alarm),
      { rule: `${menit} ${jam} * * ${kolomHari}`, tz: ZONA_WAKTU },
      () => kirimAlarm(sock, alarm),
    );

    if (job) {
      jobAlarm.set(namaJob(alarm), job);
      jumlah++;
    }
  }

  if (jumlah) logWithTime('Alarm', `${jumlah} alarm dijadwalkan`);
  return jumlah;
}

export {
  parseAlarm,
  parseHari,
  labelHari,
  normalkanWaktu,
  daftarAlarm,
  semuaAlarm,
  simpanAlarm,
  hapusAlarm,
  resetAlarm,
  syncAlarm,
  kirimAlarm,
  MODE_TAG,
  MAKS_ALARM_PER_GRUP,
  ZONA_WAKTU,
};
