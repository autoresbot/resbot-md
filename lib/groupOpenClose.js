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
import { getJadwalTeks } from './participants.js';

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
