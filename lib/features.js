import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { apiGet } from './apiClient.js';

/**
 * Cache jadwal sholat PER KOTA PER HARI.
 *
 * Jadwal hanya berubah sekali sehari, jadi API cukup dipanggil sekali per
 * kota per tanggal (WIB). Cache juga disimpan ke file supaya setelah restart
 * (yang biasanya bersamaan dengan gangguan jaringan) jadwal tetap tersedia.
 * Kalau API gagal, entri terakhir kota itu dipakai walau tanggalnya kemarin:
 * selisihnya cuma ±1 menit, jauh lebih baik daripada tidak ada jadwal.
 *
 * Bentuk: { [kota]: { tanggal: 'YYYY-MM-DD', jadwal: {...respons API} } }
 */
const CACHE_FILE = path.join(process.cwd(), 'database', 'jadwal_sholat_cache.json');
const MAX_KOTA_CACHE = 200;

let jadwalCache = muatCacheJadwal();

function muatCacheJadwal() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (data && typeof data === 'object') return data;
    }
  } catch (error) {
    console.warn('[SHOLAT] Cache jadwal rusak, diabaikan:', error.message);
  }
  return {};
}

function simpanCacheJadwal() {
  try {
    // Batasi jumlah kota (fitur .jadwalsholat bisa dipakai untuk kota apa saja).
    const entri = Object.entries(jadwalCache);
    if (entri.length > MAX_KOTA_CACHE) {
      entri.sort((a, b) => String(b[1].tanggal).localeCompare(String(a[1].tanggal)));
      jadwalCache = Object.fromEntries(entri.slice(0, MAX_KOTA_CACHE));
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(jadwalCache));
  } catch (error) {
    console.warn('[SHOLAT] Gagal menyimpan cache jadwal:', error.message);
  }
}

function tanggalWib() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function kurangiMenit(waktu, menitDikurangi) {
  let [jam, menit] = waktu.split(':').map(Number);
  let totalMenit = jam * 60 + menit - menitDikurangi;

  let newJam = Math.floor(totalMenit / 60);
  let newMenit = totalMenit % 60;

  return `${String(newJam).padStart(2, '0')}:${String(newMenit).padStart(2, '0')}`;
}

/**
 * Jadwal lengkap satu kota (imsak, subuh, dhuha, ..., tanggal) dari API.
 *
 * @returns {Promise<{ jadwal: object, dariCache: boolean, kedaluwarsa: boolean } | null>}
 *   null = API menjawab tapi kota tidak ditemukan.
 * @throws error API (isServerBusy) bila API gagal DAN belum ada cache kota itu.
 */
async function getJadwalSholatLengkap(kota = 'jakarta') {
  const kunci = String(kota).trim().toLowerCase();
  const hariIni = tanggalWib();
  const cache = jadwalCache[kunci];

  if (cache?.jadwal && cache.tanggal === hariIni) {
    return { jadwal: cache.jadwal, dariCache: true, kedaluwarsa: false };
  }

  let res;
  try {
    res = await apiGet('/api/jadwalsholat', { feature: 'SHOLAT', params: { kota: kunci } });
  } catch (error) {
    if (cache?.jadwal) {
      console.warn(`[SHOLAT] API gagal (${error.code || error.message}), memakai cache ${cache.tanggal} untuk ${kunci}`);
      return { jadwal: cache.jadwal, dariCache: true, kedaluwarsa: true };
    }
    throw error;
  }

  const jadwal = res.data?.data?.jadwal;
  if (res.status >= 200 && res.status < 300 && jadwal) {
    jadwalCache[kunci] = { tanggal: hariIni, jadwal };
    simpanCacheJadwal();
    return { jadwal, dariCache: false, kedaluwarsa: false };
  }

  if (res.status >= 400 && res.status !== 404) {
    const pesan = res.data?.message || res.data?.error || 'Unknown error';
    throw new Error(`HTTP ${res.status} - ${pesan}`);
  }

  return null;
}

/** Lima waktu sholat (dipakai notifikasi otomatis di scheduled.js). */
async function getJadwalSholat(kota = 'jakarta') {
  try {
    const hasil = await getJadwalSholatLengkap(kota);
    if (!hasil) throw new Error('Data jadwal sholat kosong.');

    // Dulu ada entri uji `tes: '19:49'` di sini yang ikut dijadwalkan, sehingga
    // setiap grup mendapat "Waktu tes telah tiba" tiap malam.
    const { subuh, dzuhur, ashar, maghrib, isya } = hasil.jadwal;
    return { subuh, dzuhur, ashar, maghrib, isya };
  } catch (error) {
    console.error('Error in getJadwalSholat:', error.message);
    throw new Error('Gagal mendapatkan waktu sholat');
  }
}

async function textToAudio(text) {
  try {
    // Validasi input
    if (!text || typeof text !== 'string') {
      throw new Error('Teks harus berupa string yang valid.');
    }

    // Potong teks menjadi maksimal 199 karakter
    const maxLength = 190; // Batas aman
    const truncatedText = text.slice(0, maxLength).trim();

    // URL layanan Google Translate TTS
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${truncatedText}&tl=id&client=tw-ob`;

    // Mendapatkan data audio dari URL
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    // Periksa apakah audio diterima
    if (!response || response.status !== 200) {
      throw new Error('Gagal mendapatkan audio dari Google Translate TTS.');
    }

    return Buffer.from(response.data);
  } catch (error) {
    console.error('Error in textToAudio:', error.message);
    throw new Error('Gagal mengubah teks menjadi audio.');
  }
}
export { textToAudio, getJadwalSholat, getJadwalSholatLengkap };
