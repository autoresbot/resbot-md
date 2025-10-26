// Database sementara menggunakan objek
const DB_tictactoe = {};

/**
 * Menambahkan data pengguna ke database
 * @param {string} remoteJid - ID pengguna (unik)
 * @param {object} data - Data game pengguna (angka acak, level, dll.)
 */
function addUser(remoteJid, data) {
  DB_tictactoe[remoteJid] = data;
}

function updateGame(remoteJid, newData) {
  if (DB_tictactoe[remoteJid]) {
    // Perbarui hanya data yang ada di newData
    DB_tictactoe[remoteJid] = {
      ...DB_tictactoe[remoteJid],
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
  delete DB_tictactoe[remoteJid];
}

/**
 * Mendapatkan data pengguna dari database
 * @param {string} remoteJid - ID pengguna (unik)
 * @returns {object|null} - Data pengguna atau null jika tidak ditemukan
 */
function getUser(remoteJid) {
  return DB_tictactoe[remoteJid] || null;
}

/**
 * Mengecek apakah pengguna sedang bermain
 * @param {string} remoteJid - ID pengguna (unik)
 * @returns {boolean} - True jika pengguna ada di database, false jika tidak
 */
function isUserPlaying(remoteJid) {
  return Boolean(DB_tictactoe[remoteJid]);
}

// Ekspor fungsi dan database
export {
  DB_tictactoe,
  addUser,
  removeUser,
  getUser,
  isUserPlaying,
  updateGame,
};
