/**
 * ytdownloader.js - Pemanggilan API downloader YouTube yang tahan gagal.
 *
 * Dipakai bersama oleh .play, .playvid, .ytmp3, dan .ytmp4. Sebelumnya
 * keempatnya punya salinan `fetchWithRetry` sendiri-sendiri dengan perilaku
 * yang sedikit berbeda, dan semuanya punya dua masalah yang sama:
 *
 *  1. pengecekan hasilnya ditulis `response.data.url`. Kalau API menjawab
 *     tanpa field `data` (mis. `{ status: false, message: '...' }`), baris itu
 *     melempar TypeError "Cannot read properties of undefined (reading 'url')".
 *     Error teknis itulah yang akhirnya dikirim mentah-mentah ke user, dan
 *     alasan aslinya dari API justru hilang.
 *  2. SEMUA kegagalan diulang sampai 12-14 kali dengan jeda tetap, termasuk
 *     kegagalan yang tidak mungkin berubah (APIKEY salah, link ditolak).
 *     User menunggu satu sampai dua menit untuk hasil yang sudah pasti gagal.
 *
 * Modul ini memperbaiki keduanya: link media dicari di semua bentuk response
 * yang mungkin, kegagalan yang percuma diulang langsung dihentikan, sisanya
 * diulang dengan jeda bertingkat, dan pesan ke user memakai bahasa manusia.
 */

import { logWithTime } from './utils.js';

const PERCOBAAN_DEFAULT = 8;
const JEDA_DEFAULT = 4000; // jeda awal, naik bertingkat tiap percobaan
const JEDA_MAKS = 15000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Cari link media di response API.
 *
 * Bentuk response berbeda-beda tergantung endpoint dan versi API, jadi semua
 * kemungkinan dicoba - bukan cuma `data.url` seperti versi lama.
 */
function ambilUrlMedia(response) {
  const kandidat = [
    response?.data?.url,
    response?.data?.result?.url,
    response?.data?.data?.url,
    response?.data?.download?.url,
    response?.data?.link,
    response?.result?.url,
    response?.url,
  ];

  return kandidat.find((url) => typeof url === 'string' && url.startsWith('http')) || null;
}

/** Alasan penolakan yang dikirim API, kalau ada. */
function alasanApi(response) {
  const pesan =
    response?.message || response?.msg || response?.error || response?.data?.message;
  return typeof pesan === 'string' && pesan.trim() ? pesan.trim() : null;
}

/**
 * Kegagalan yang PERCUMA diulang: masalahnya ada di APIKEY, link, atau
 * endpoint - bukan server yang sedang sibuk. Diulang 8 kali pun hasilnya sama,
 * jadi lebih baik user langsung diberi tahu.
 */
const POLA_PERCUMA_DIULANG = [
  /^Unauthorized/i,
  /^Forbidden/i,
  /^Not Found/i,
  /^Bad Request/i,
  /api ?key/i,
];

function percumaDiulang(error) {
  const pesan = String(error?.message || error || '');
  return POLA_PERCUMA_DIULANG.some((pola) => pola.test(pesan));
}

/** Terjemahkan error teknis jadi kalimat yang dimengerti user biasa. */
function alasanUntukUser(error) {
  const pesan = String(error?.message || error || '');

  if (/reading 'url'|tidak memuat link/i.test(pesan)) {
    return 'server downloader tidak mengembalikan link unduhan';
  }
  if (/^Unauthorized|^Forbidden|api ?key/i.test(pesan)) {
    return 'APIKEY tidak valid, kedaluwarsa, atau kuotanya habis';
  }
  if (/Too Many Requests/i.test(pesan)) {
    return 'permintaan ke server downloader sedang terlalu banyak';
  }
  if (/Internal Server Error/i.test(pesan)) {
    return 'server downloader sedang bermasalah';
  }
  if (/No response received|ETIMEDOUT|ECONNRESET|ENOTFOUND|timeout/i.test(pesan)) {
    return 'server downloader tidak merespons';
  }
  if (/^Not Found/i.test(pesan)) {
    return 'endpoint downloader tidak ditemukan';
  }
  if (/^Bad Request/i.test(pesan)) {
    return 'link yang dikirim ditolak server downloader';
  }
  if (/API menolak: /i.test(pesan)) {
    return pesan.replace(/^API menolak: /i, '');
  }

  return pesan || 'penyebab tidak diketahui';
}

/**
 * Ambil link media dari API, ulangi kalau gagal.
 *
 * @returns {Promise<{ url: string, response: object, percobaanKe: number }>}
 * @throws {Error} error terakhir, dengan properti tambahan `percobaan`
 */
async function ambilMediaDenganRetry(api, endpoint, params, opsi = {}) {
  const {
    percobaan = PERCOBAAN_DEFAULT,
    jeda = JEDA_DEFAULT,
    jedaMaks = JEDA_MAKS,
    label = endpoint,
  } = opsi;

  let errorTerakhir;

  for (let ke = 1; ke <= percobaan; ke++) {
    try {
      const response = await api.get(endpoint, params);
      const url = ambilUrlMedia(response);

      if (url) return { url, response, percobaanKe: ke };

      // Alasan dari API dipakai apa adanya kalau ada, supaya tidak tertukar
      // dengan TypeError yang dulu muncul di sini.
      const alasan = alasanApi(response);
      throw new Error(
        alasan ? `API menolak: ${alasan}` : 'Response API tidak memuat link unduhan',
      );
    } catch (error) {
      errorTerakhir = error;

      if (percumaDiulang(error)) {
        error.percobaan = ke;
        error.percuma = true;
        throw error;
      }

      if (ke < percobaan) {
        // Jeda bertingkat: makin sering gagal, makin lama menunggu. Jeda tetap
        // (versi lama) justru menghantam server yang sedang kewalahan.
        const tunggu = Math.min(jeda * ke, jedaMaks);
        logWithTime(
          'DOWNLOADER',
          `${label} gagal (percobaan ${ke}/${percobaan}): ${error?.message || error} - ulang dalam ${tunggu / 1000}s`,
        );
        await delay(tunggu);
      }
    }
  }

  const akhir = errorTerakhir instanceof Error ? errorTerakhir : new Error(String(errorTerakhir));
  akhir.percobaan = percobaan;
  throw akhir;
}

/**
 * Pesan gagal yang rapi untuk dikirim ke user.
 *
 * Menggantikan "Detail Error: Cannot read properties of undefined
 * (reading 'url')" yang tidak berarti apa-apa buat user.
 */
function pesanGagal(jenis, error, ulangiDengan = '') {
  const alasan = alasanUntukUser(error);
  const percobaan = error?.percobaan;

  const usaha = error?.percuma
    ? '_Permintaan langsung ditolak server, jadi tidak diulang._'
    : percobaan > 1
      ? `_Sudah dicoba otomatis ${percobaan} kali, tapi tetap gagal._`
      : '_Permintaan gagal diproses._';

  const saran = error?.percuma
    ? '_Laporkan ke owner bot ya._'
    : ulangiDengan
      ? `_Coba lagi beberapa menit lagi dengan *${ulangiDengan}*_`
      : '_Silakan coba lagi beberapa menit lagi._';

  return `⚠️ _Gagal mengambil ${jenis} dari YouTube._\n\n${usaha}\n\n◧ _Penyebab: ${alasan}_\n\n${saran}`;
}

export { ambilMediaDenganRetry, ambilUrlMedia, alasanApi, alasanUntukUser, pesanGagal, delay };
