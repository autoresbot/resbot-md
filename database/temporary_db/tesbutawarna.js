// Database sementara menggunakan objek
const DB_tesbutawarna = {};

/**
 * Menambahkan data pengguna ke database
 * @param {string} remoteJid - ID pengguna (unik)
 * @param {object} data - Data game pengguna (angka acak, level, dll.)
 */
function addUser(remoteJid, data) {
  DB_tesbutawarna[remoteJid] = data;
}

/**
 * Menghapus data pengguna dari database
 * @param {string} remoteJid - ID pengguna (unik)
 */
function removeUser(remoteJid) {
  delete DB_tesbutawarna[remoteJid];
}

/**
 * Mendapatkan data pengguna dari database
 * @param {string} remoteJid - ID pengguna (unik)
 * @returns {object|null} - Data pengguna atau null jika tidak ditemukan
 */
function getUser(remoteJid) {
  return DB_tesbutawarna[remoteJid] || null;
}

/**
 * Mengecek apakah pengguna sedang bermain
 * @param {string} remoteJid - ID pengguna (unik)
 * @returns {boolean} - True jika pengguna ada di database, false jika tidak
 */
function isUserPlaying(remoteJid) {
  return Boolean(DB_tesbutawarna[remoteJid]);
}

// Ekspor fungsi dan database
export { DB_tesbutawarna, addUser, removeUser, getUser, isUserPlaying };
