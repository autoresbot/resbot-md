/**
 * apiClient.js - Satu pintu untuk request ke api.autoresbot.com.
 *
 * - timeout 15 detik
 * - retry maksimal 3x (jeda 1s, 2s, 4s) HANYA untuk gangguan sementara:
 *   error jaringan (ETIMEDOUT, ECONNRESET, ENETUNREACH, EAI_AGAIN,
 *   UND_ERR_CONNECT_TIMEOUT) dan HTTP 5xx / 429.
 * - log ringkas per percobaan: [API:<fitur>] percobaan 1/4 gagal: ETIMEDOUT
 *
 * Respons 2xx-4xx dikembalikan apa adanya (tidak dilempar) supaya pemanggil
 * bisa membaca pesan error dari API (apikey salah, kota tidak ditemukan, dll).
 * Kalau semua percobaan habis karena gangguan sementara, dilempar error
 * dengan `isServerBusy = true` (cek dengan isServerBusyError()).
 */
import axios from 'axios';
import config from '../config.js';
import { logLine } from './errorLogger.js';

const API_BASE_URL = 'https://api.autoresbot.com';
const TIMEOUT_MS = 15000;
const RETRY_DELAYS_MS = [1000, 2000, 4000]; // jumlah elemen = jumlah retry

const RETRYABLE_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ENETUNREACH',
  'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT',
]);

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUT_MS,
  validateStatus: () => true,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Node melaporkan kegagalan Happy Eyeballs sebagai AggregateError tanpa
// `code` di level atas; kodenya ada di error-error di dalamnya.
function errorCode(error) {
  return (
    error?.code ||
    error?.cause?.code ||
    error?.errors?.find?.((e) => e?.code)?.code ||
    null
  );
}

function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

function isServerBusyError(error) {
  return Boolean(error?.isServerBusy);
}

/**
 * @param {object} options
 * @param {string} options.feature   Nama fitur untuk log, mis. 'HD', 'SHOLAT'.
 * @param {string} options.url       Path (/api/...) atau URL lengkap.
 * @param {boolean} [options.auth=true]  Kirim header Authorization dari config.APIKEY.
 *   Sisanya (method, params, data, headers, responseType, ...) diteruskan ke axios.
 * @returns {Promise<import('axios').AxiosResponse>}
 */
async function apiRequest({ feature = 'API', auth = true, ...axiosConfig }) {
  const headers = { ...(axiosConfig.headers || {}) };
  if (auth && config.APIKEY && !headers.Authorization) {
    headers.Authorization = `Bearer ${config.APIKEY}`;
  }

  const maxAttempt = RETRY_DELAYS_MS.length + 1;
  let lastProblem = '';

  for (let attempt = 1; attempt <= maxAttempt; attempt++) {
    let res;
    try {
      res = await http.request({ method: 'get', ...axiosConfig, headers });
    } catch (error) {
      const code = errorCode(error);
      if (!RETRYABLE_CODES.has(code)) throw error; // bukan gangguan sementara

      lastProblem = code;
    }

    if (res) {
      if (!isRetryableStatus(res.status)) return res;
      lastProblem = `HTTP ${res.status}`;
    }

    const line = `[API:${feature}] percobaan ${attempt}/${maxAttempt} gagal: ${lastProblem}`;
    console.warn(line);
    logLine('api.log', line);

    if (attempt < maxAttempt) await sleep(RETRY_DELAYS_MS[attempt - 1]);
  }

  const error = new Error(`Server sedang sibuk (${lastProblem})`);
  error.code = lastProblem;
  error.isServerBusy = true;
  throw error;
}

const apiGet = (url, options = {}) => apiRequest({ ...options, method: 'get', url });

export { apiRequest, apiGet, isServerBusyError, API_BASE_URL };
export default apiRequest;
