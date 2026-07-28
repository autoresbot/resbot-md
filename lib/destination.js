/**
 * destination.js - Aturan tunggal untuk config `bot_destination`.
 *
 * config.js:
 *   const DESTINATION = 'group'; // group , private, both
 *
 * Arti:
 *   'private' -> bot HANYA melayani chat pribadi, diam total di grup
 *   'group'   -> bot HANYA melayani grup, diam total di chat pribadi
 *   'both'    -> bot melayani keduanya
 *
 * Sebelumnya aturan ini ditulis langsung (inline) di autoresbot.js dan hanya
 * dipasang pada satu titik — tepat sebelum pencarian command — sehingga seluruh
 * handler di folder `handle/` sudah terlanjur berjalan lebih dulu. Akibatnya
 * setelan 'private' tidak benar-benar mematikan bot di grup.
 *
 * Aturan dipusatkan di sini supaya SEMUA jalur masuk (pesan, event grup,
 * handler fitur grup) memakai definisi yang sama persis.
 */

import config from '../config.js';

/**
 * Ambil nilai destination yang sudah dinormalisasi.
 * Aman terhadap nilai kosong/undefined (tidak melempar error).
 */
function getDestination() {
  return String(config.bot_destination || 'both')
    .toLowerCase()
    .trim();
}

/**
 * Apakah bot boleh bertindak pada jenis chat ini?
 *
 * @param {boolean} isGroup - true bila target berupa grup
 * @returns {boolean}
 *
 * Nilai selain 'private'/'group' (mis. 'both' atau salah ketik) tetap
 * mengizinkan semuanya — sama seperti perilaku lama.
 */
function isDestinationAllowed(isGroup) {
  const destination = getDestination();

  if (destination === 'private') return !isGroup;
  if (destination === 'group') return Boolean(isGroup);

  return true; // 'both'
}

export { getDestination, isDestinationAllowed };
