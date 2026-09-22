/**
 * accPilihan.js - Nomor urut hasil .listacc, supaya owner bisa mengetik
 * `.acc 3` alih-alih menyalin ID grup yang panjang.
 *
 * Disimpan di memori saja (hilang saat restart) dan berbatas, karena ini cuma
 * jalan pintas mengetik — sumber kebenarannya tetap tabel acc_groups.
 */

import { createBoundedMap } from './boundedStore.js';

// 1 jam: cukup untuk mengetik .acc setelah melihat daftar.
const pilihan = createBoundedMap({ max: 100, ttl: 60 * 60 * 1000 });

/** @param {string[]} groupIds urutan grup persis seperti yang ditampilkan */
function simpanPilihan(ownerId, groupIds) {
  if (ownerId) pilihan.set(ownerId, groupIds);
}

/** @returns {string|null} ID grup pada nomor urut tsb, atau null */
function ambilPilihan(ownerId, nomor) {
  const daftar = pilihan.get(ownerId);
  if (!Array.isArray(daftar)) return null;
  return daftar[nomor - 1] || null;
}

/**
 * Tentukan grup tujuan .acc / .unacc.
 *
 * Yang diterima:
 * - tanpa isi        -> grup tempat command diketik (hanya kalau di grup)
 * - nomor urut       -> nomor dari daftar .listacc terakhir, mis. "3"
 * - id grup          -> 1203...@g.us, boleh juga tanpa "@g.us"
 *
 * @returns {{ id: string|null, pesan: string|null }} pesan diisi bila gagal
 */
function targetGrup({ content, senderLid, remoteJid, isGroup, prefix, command }) {
  const isi = (content || '').trim();

  if (!isi) {
    if (isGroup) return { id: remoteJid, pesan: null };
    return {
      id: null,
      pesan:
        `_⚠️ Ketik *${prefix}${command}* di dalam grup, atau sebutkan grupnya dari sini._\n\n` +
        `_Contoh:_\n_*${prefix}${command} 120363212819490620@g.us*_\n_*${prefix}${command} 3* (nomor dari ${prefix}listacc)_\n\n` +
        `_Lihat daftar grup: *${prefix}listacc*_`,
    };
  }

  // Nomor urut dari .listacc (ID grup selalu jauh lebih panjang dari 4 digit)
  if (/^\d{1,4}$/.test(isi)) {
    const dariDaftar = ambilPilihan(senderLid, Number(isi));
    if (dariDaftar) return { id: dariDaftar, pesan: null };
    return {
      id: null,
      pesan: `_⚠️ Nomor *${isi}* tidak ada di daftar._\n\n_Ketik *${prefix}listacc* dulu untuk melihat daftar grupnya._`,
    };
  }

  const id = isi.includes('@') ? isi : `${isi.replace(/\D/g, '')}@g.us`;
  if (!/^\d+@g\.us$/.test(id)) {
    return { id: null, pesan: `_⚠️ ID grup tidak valid: ${isi}_` };
  }
  return { id, pesan: null };
}

export { simpanPilihan, ambilPilihan, targetGrup };
