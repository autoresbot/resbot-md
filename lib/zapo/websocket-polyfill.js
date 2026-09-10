/**
 * Polyfill `globalThis.WebSocket` untuk Node < 22.
 *
 * zapo-js membuka koneksi lewat `globalThis.WebSocket` dan melempar
 * "global WebSocket is not available in this runtime" kalau tidak ada.
 * Global itu baru stabil di Node 22; project ini berjalan di Node 20, jadi
 * implementasi dari paket `ws` dipasang sebagai gantinya.
 *
 * `ws` adalah superset dari WebSocket standar — ia menerima argumen ketiga
 * berisi `{ headers, agent }` yang memang dipakai zapo saat proxy aktif.
 *
 * File ini WAJIB di-import sebelum `new WaClient(...)`, karena konstruktor
 * WebSocket di-resolve sekali di awal, bukan saat koneksi dibuka.
 */

import { WebSocket } from 'ws';

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket;
}

export default globalThis.WebSocket;
