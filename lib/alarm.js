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
function simpanAlarm(groupId, { name, message, time, tag }, createdBy = '') {
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
      'UPDATE alarms SET message = ?, time = ?, tag = ?, created_by = ? WHERE id = ?',
    ).run(message, time, tag, createdBy, adaSebelumnya.id);
  } else {
    getStmt(
      'insertAlarm',
      'INSERT INTO alarms (group_id, name, message, time, tag, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(groupId, name, message, time, tag, createdBy);
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
    // peduli zona waktu server (panel sering UTC).
    const job = schedule.scheduleJob(
      namaJob(alarm),
      { rule: `${menit} ${jam} * * *`, tz: ZONA_WAKTU },
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
