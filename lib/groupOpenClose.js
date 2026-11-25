/**
 * groupOpenClose.js - Logika bersama untuk membuka/menutup grup.
 *
 * Dipakai oleh: `.gc open/close`, `.open`, `.close`, dan `.setopen`/`.setclose`.
 * Dibuat satu tempat supaya pesan balasan (termasuk pesan custom per-grup)
 * konsisten dan tidak terduplikasi.
 *
 * Pesan custom disimpan memakai penyimpanan yang SAMA dengan jadwal otomatis
 * (.setopengc / .setclosegc), yaitu `openText` / `closeText` lewat
 * setJadwalTeks()/getJadwalTeks() di lib/participants.js. Dengan begitu pesan
 * custom yang diatur user berlaku baik untuk buka/tutup manual maupun otomatis.
 */
import mess from '../strings.js';
import config from '../config.js';
import { getJadwalTeks } from './participants.js';
import { isAccGroup } from './accGroups.js';
import { pesertaAdalahAdmin } from './cache.js';

/** Semua bentuk identitas bot (nomor & LID) untuk dicocokkan ke peserta grup. */
export function identitasBot(sock) {
  const creds = sock?.zapo?.auth?.getCurrentCredentials?.() ?? null;
  return [sock?.user?.id, sock?.user?.lid, creds?.meJid, creds?.meLid].filter(Boolean);
}

/**
 * Apakah bot admin di grup ini?
 * @returns {boolean|null} null bila tidak bisa dipastikan (identitas bot /
 *   daftar peserta belum tersedia) — pemanggil jangan menganggapnya "bukan admin".
 */
export function botAdalahAdmin(sock, metadata) {
  const ids = identitasBot(sock);
  if (!ids.length || !Array.isArray(metadata?.participants)) return null;
  return pesertaAdalahAdmin(metadata.participants, ...ids);
}

/**
 * Analisis syarat jadwal buka/tutup otomatis (.setopengc / .setclosegc).
 * Dipakai saat jadwal diatur (supaya admin langsung tahu) dan saat jadwal
 * dijalankan (supaya alasan gagalnya jelas, tidak diam saja).
 *
 * @returns {{kode: string, pesan: string}[]} kosong = semua syarat terpenuhi
 */
export function cekSyaratJadwal(sock, groupId, metadata) {
  const masalah = [];
  if (!config.scheduled) {
    masalah.push({
      kode: 'scheduled_off',
      pesan: 'Fitur jadwal dimatikan di config bot (*scheduled: false*). Owner perlu menyalakannya lalu restart bot.',
    });
  }
  if (!isAccGroup(groupId)) {
    masalah.push({
      kode: 'belum_acc',
      pesan: 'Grup ini belum di-*.acc* owner. Bot tidak menjalankan fitur apa pun di grup yang belum di-acc.',
    });
  }
  if (botAdalahAdmin(sock, metadata) === false) {
    masalah.push({
      kode: 'bukan_admin',
      pesan: 'Bot belum menjadi *admin* grup. Hanya admin yang bisa membuka/menutup grup.',
    });
  }
  return masalah;
}

/** Ubah galat WhatsApp yang teknis menjadi alasan yang bisa dipahami admin. */
export function alasanGagalToggle(error) {
  const teks = String(error?.message || error || '');
  if (/not-authorized|forbidden|401|403|admin/i.test(teks)) {
    return 'Bot belum menjadi admin grup (WhatsApp menolak perubahan pengaturan grup).';
  }
  if (/item-not-found|404|not.*participant|gone|406/i.test(teks)) {
    return 'Bot sudah tidak berada di grup ini.';
  }
  if (/timeout|timed out|closed|connection|socket|registered meJid/i.test(teks)) {
    return `Koneksi bot ke WhatsApp sedang terputus (${teks}).`;
  }
  return teks || 'Kesalahan tidak diketahui.';
}

/**
 * Ambil teks balasan untuk aksi open/close.
 * Prioritas: pesan custom grup (openText/closeText) -> default strings.js
 */
export function getOpenCloseText(remoteJid, action) {
  const property = action === 'open' ? 'openText' : 'closeText';
  const fallback = action === 'open' ? mess.action.grub_open : mess.action.grub_close;

  try {
    const custom = getJadwalTeks(remoteJid, property);
    if (typeof custom === 'string' && custom.trim() !== '') return custom;
  } catch {
    /* pakai fallback */
  }

  return fallback;
}

/**
 * Jalankan aksi buka/tutup grup lalu balas dengan teks yang sesuai.
 * `action` wajib 'open' atau 'close'.
 */
export async function applyGroupToggle(sock, messageInfo, action) {
  const { remoteJid, message } = messageInfo;

  await sock.groupSettingUpdate(
    remoteJid,
    action === 'open' ? 'not_announcement' : 'announcement',
  );

  const responseText = getOpenCloseText(remoteJid, action);

  return sock.sendMessage(remoteJid, { text: responseText }, { quoted: message });
}
