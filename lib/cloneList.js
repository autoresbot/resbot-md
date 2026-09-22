/**
 * cloneList.js - Kode sementara untuk menyalin list antar grup.
 *
 * Alur:
 *   1. Admin grup sumber ketik .idclone  -> bot memberi kode (berlaku 10 menit)
 *   2. Admin grup tujuan ketik .clonegc <kode> -> list grup sumber disalin
 *
 * Kode disimpan di memori, bukan database: umurnya hanya menit dan hilang saat
 * restart justru perilaku yang diinginkan (kode lama tidak boleh menggantung).
 * createBoundedMap menjaga TTL + batas jumlah entri supaya tidak bocor memori.
 */

import { createBoundedMap } from './boundedStore.js';

const MASA_BERLAKU = 10 * 60 * 1000; // 10 menit

/** Tanpa 0/O/1/I supaya tidak salah baca saat diketik ulang. */
const HURUF = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const kodeAktif = createBoundedMap({ max: 500, ttl: MASA_BERLAKU });

function acakKode() {
  let hasil = '';
  for (let i = 0; i < 6; i++) {
    hasil += HURUF[Math.floor(Math.random() * HURUF.length)];
  }
  return hasil;
}

/**
 * Buat kode clone baru untuk sebuah grup.
 *
 * @param {string} sumberJid grup yang list-nya akan disalin
 * @param {string} pembuat   jid admin yang meminta kode (untuk jejak audit)
 * @returns {{kode: string, kedaluwarsa: number}}
 */
function buatKodeClone(sumberJid, pembuat) {
  let kode = acakKode();
  // Tabrakan hampir mustahil, tapi kode kembar berarti list grup lain yang
  // tersalin -> lebih baik diulang daripada ditimpa.
  while (kodeAktif.get(kode)) kode = acakKode();

  kodeAktif.set(kode, { sumberJid, pembuat, dibuat: Date.now() });

  return { kode, kedaluwarsa: MASA_BERLAKU };
}

/**
 * Ambil data kode tanpa menghapusnya.
 * @returns {{sumberJid: string, pembuat: string, dibuat: number}|undefined}
 */
function ambilKodeClone(kode) {
  return kodeAktif.get(String(kode || '').trim().toUpperCase());
}

/** Kode sekali pakai: dibuang setelah berhasil dipakai. */
function hapusKodeClone(kode) {
  return kodeAktif.delete(String(kode || '').trim().toUpperCase());
}

export { buatKodeClone, ambilKodeClone, hapusKodeClone, MASA_BERLAKU };
