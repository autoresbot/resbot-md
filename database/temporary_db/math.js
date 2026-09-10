// Database sementara menggunakan objek
const DB_math = {};

/**
 * Menambahkan data pengguna ke database
 * @param {string} remoteJid - ID pengguna (unik)
 * @param {object} data - Data game pengguna (angka acak, level, dll.)
 */
function addUser(remoteJid, data) {
  DB_math[remoteJid] = data;
}

function updateGame(remoteJid, newData) {
  if (DB_math[remoteJid]) {
    // Perbarui hanya data yang ada di newData
    DB_math[remoteJid] = {
      ...DB_math[remoteJid],
      ...newData,
    };
  } else {
    console.error(
      `User dengan remoteJid ${remoteJid} tidak ditemukan untuk diperbarui.`
    );
  }
}

/**
 * Menghapus data pengguna dari database
 * @param {string} remoteJid - ID pengguna (unik)
 */
function removeUser(remoteJid) {
  delete DB_math[remoteJid];
}

/**
 * Mendapatkan data pengguna dari database
 * @param {string} remoteJid - ID pengguna (unik)
 * @returns {object|null} - Data pengguna atau null jika tidak ditemukan
 */
function getUser(remoteJid) {
  return DB_math[remoteJid] || null;
}

/**
 * Mengecek apakah pengguna sedang bermain
 * @param {string} remoteJid - ID pengguna (unik)
 * @returns {boolean} - True jika pengguna ada di database, false jika tidak
 */
function isUserPlaying(remoteJid) {
  return Boolean(DB_math[remoteJid]);
}

// Ekspor fungsi dan database
export { DB_math, addUser, removeUser, getUser, isUserPlaying, updateGame };
