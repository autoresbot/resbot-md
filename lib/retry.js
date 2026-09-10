/**
 * retry.js - Helper Retry Universal
 *
 * FIX: retry sholat API (dan request lain) maksimal 3x dengan
 * exponential delay (1s, 2s, 3s). Jika tetap gagal, lempar error terakhir.
 */

import { logLine } from './errorLogger.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Menjalankan `fn` dengan percobaan ulang.
 *
 * @param {Function} fn         Fungsi async yang akan dijalankan.
 * @param {Object}   options
 * @param {number}   options.maxRetry  Jumlah percobaan maksimal (default 3).
 * @param {string}   options.label     Label untuk log (mis. 'SHOLAT_RETRY').
 * @param {string}   options.logFile   Nama file log (mis. 'api.log').
 * @returns hasil dari `fn`
 */
async function retryRequest(fn, options = {}) {
  const { maxRetry = 3, label = 'RETRY', logFile = 'api.log' } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      // Coba ambil status code / penyebab error (axios, undici fetch, dll)
      const status =
        error?.response?.status ||
        error?.status ||
        error?.code ||
        error?.cause?.code ||
        error?.cause?.message ||
        error?.message ||
        'unknown';

      // [SHOLAT_RETRY] Attempt: 1 Error: 502
      logLine(logFile, `[${label}] Attempt: ${attempt} Error: ${status}`);
      console.warn(`[${label}] Attempt: ${attempt} Error: ${status}`);

      // Jika ini percobaan terakhir, jangan delay lagi
      if (attempt >= maxRetry) break;

      // Exponential delay sederhana: 1s, 2s, 3s ...
      await sleep(attempt * 1000);
    }
  }

  // Semua percobaan gagal -> lempar error terakhir
  throw lastError;
}

export { retryRequest };
export default retryRequest;
