/**
 * boundedStore.js - Penyimpanan sementara di memori yang TIDAK tumbuh tanpa batas.
 *
 * Latar belakang (audit):
 * Banyak file memakai object/Set biasa sebagai cache rate-limit atau penanda
 * "sudah dinotifikasi", misalnya:
 *
 *   const lastMessageTime = {};        // key: remoteJid  -> tidak pernah dihapus
 *   const notifiedUsers = new Set();   // key: jid/notifKey -> tidak pernah dihapus
 *
 * Pada bot yang hidup berhari-hari, setiap remoteJid / user baru menambah entri
 * permanen sehingga pemakaian memori terus naik (memory leak).
 *
 * Helper ini menjaga PERILAKU tetap sama (nilai yang baru ditulis selalu bisa
 * dibaca kembali), namun membuang entri yang sudah kedaluwarsa (TTL) dan
 * membatasi jumlah entri maksimum (eviksi paling lama masuk lebih dulu).
 *
 * TTL default sengaja dibuat jauh lebih besar daripada jendela pemakaian
 * aslinya (rate limit hitungan detik, notifikasi hitungan jam), sehingga
 * pembersihan tidak pernah memotong logika yang sedang berjalan.
 */

const DEFAULT_MAX = 5000;
const DEFAULT_TTL = 6 * 60 * 60 * 1000; // 6 jam

/**
 * Map dengan TTL + batas jumlah entri.
 *
 * Dipakai untuk menggantikan object rate-limit seperti `lastMessageTime[jid]`.
 *
 * @param {object} opts
 * @param {number} opts.max - jumlah entri maksimum sebelum entri terlama dibuang
 * @param {number} opts.ttl - umur entri dalam ms
 */
function createBoundedMap({ max = DEFAULT_MAX, ttl = DEFAULT_TTL } = {}) {
  const store = new Map(); // key -> { value, expireAt }

  function sweep(now) {
    for (const [key, entry] of store) {
      if (entry.expireAt <= now) store.delete(key);
      else break; // Map menjaga urutan insert; entri berikutnya pasti lebih baru
    }
  }

  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expireAt <= Date.now()) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },

    set(key, value) {
      const now = Date.now();
      sweep(now);

      // Hapus dulu agar key yang di-set ulang pindah ke urutan paling belakang,
      // sehingga eviksi benar-benar membuang yang paling lama tidak dipakai.
      store.delete(key);
      store.set(key, { value, expireAt: now + ttl });

      while (store.size > max) {
        const oldest = store.keys().next().value;
        store.delete(oldest);
      }

      return value;
    },

    has(key) {
      return this.get(key) !== undefined;
    },

    delete(key) {
      return store.delete(key);
    },

    get size() {
      return store.size;
    },
  };
}

/**
 * Set dengan TTL + batas jumlah entri.
 *
 * Dipakai untuk menggantikan `new Set()` penanda notifikasi, mis.
 * `notifiedUsers.has(notifKey)` / `notifiedUsers.add(notifKey)`.
 *
 * API-nya sengaja dibuat mirip Set (has/add/delete) supaya pemanggil lama
 * tidak perlu diubah polanya.
 */
function createBoundedSet({ max = DEFAULT_MAX, ttl = DEFAULT_TTL } = {}) {
  const map = createBoundedMap({ max, ttl });

  return {
    has(key) {
      return map.get(key) === true;
    },
    add(key) {
      map.set(key, true);
      return this;
    },
    delete(key) {
      return map.delete(key);
    },
    get size() {
      return map.size;
    },
  };
}

export { createBoundedMap, createBoundedSet };
