// Database sementara menggunakan objek
const DB_tebak_lagu = {};

/**
 * Menambahkan data pengguna ke database
 * @param {string} remoteJid - ID pengguna (unik)
 * @param {object} data - Data game pengguna (angka acak, level, dll.)
 */
function addUser(remoteJid, data) {
  console.log(data);
  DB_tebak_lagu[remoteJid] = data;
}

/**
 * Menghapus data pengguna dari database
 * @param {string} remoteJid - ID pengguna (unik)
 */
function removeUser(remoteJid) {
  delete DB_tebak_lagu[remoteJid];
}

/**
 * Mendapatkan data pengguna dari database
 * @param {string} remoteJid - ID pengguna (unik)
 * @returns {object|null} - Data pengguna atau null jika tidak ditemukan
 */
function getUser(remoteJid) {
  return DB_tebak_lagu[remoteJid] || null;
}

/**
 * Mengecek apakah pengguna sedang bermain
 * @param {string} remoteJid - ID pengguna (unik)
 * @returns {boolean} - True jika pengguna ada di database, false jika tidak
 */
function isUserPlaying(remoteJid) {
  return Boolean(DB_tebak_lagu[remoteJid]);
}

// Ekspor fungsi dan database
export { DB_tebak_lagu, addUser, removeUser, getUser, isUserPlaying };
