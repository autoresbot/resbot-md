// Database sementara menggunakan objek
const DB_suit = {};

/**
 * Menambahkan data pengguna ke database
 * @param {string} remoteJid - ID pengguna (unik)
 * @param {object} data - Data game pengguna (angka acak, level, dll.)
 */
function addUser(remoteJid, data) {
  DB_suit[remoteJid] = data;
}

function updateUser(remoteJid, newData) {
  if (DB_suit[remoteJid]) {
    // Perbarui hanya data yang ada di newData
    DB_suit[remoteJid] = {
      ...DB_suit[remoteJid],
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
  delete DB_suit[remoteJid];
}

/**
 * Mendapatkan data pengguna dari database
 * @param {string} remoteJid - ID pengguna (unik)
 * @returns {object|null} - Data pengguna atau null jika tidak ditemukan
 */
function getUser(remoteJid) {
  return DB_suit[remoteJid] || null;
}

/**
 * Mengecek apakah pengguna sedang bermain
 * @param {string} remoteJid - ID pengguna (unik)
 * @returns {boolean} - True jika pengguna ada di database, false jika tidak
 */
function isUserPlaying(remoteJid) {
  return Boolean(DB_suit[remoteJid]);
}

function findDataByKey(searchCriteria) {
  const key = Object.keys(searchCriteria)[0]; // Ambil key dari objek parameter
  let value = searchCriteria[key]; // Ambil nilai yang ingin dicocokkan

  // Jika value kosong, set menjadi null
  if (value === "" || value === undefined || value === null) {
    value = null;
  }

  for (const remoteJid in DB_suit) {
    if (DB_suit[remoteJid][key] === value) {
      return {
        remoteJid,
        ...DB_suit[remoteJid],
      }; // Kembalikan data langsung tanpa array
    }
  }

  return null; // Jika tidak ada yang cocok, kembalikan null
}

// Ekspor fungsi dan database
export {
  DB_suit,
  addUser,
  removeUser,
  getUser,
  isUserPlaying,
  findDataByKey,
  updateUser,
};
