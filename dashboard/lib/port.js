/**
 * port.js - Menentukan port dashboard & mengecek ketersediaannya.
 *
 * Pterodactyl memberi tiap server satu "allocation" (IP:port) lewat env
 * SERVER_IP & SERVER_PORT. Port di luar allocation itu tidak bisa diakses
 * dari luar container, jadi di panel dashboard HANYA boleh memakai
 * SERVER_PORT. Kalau server tidak punya allocation, dashboard tidak dijalankan.
 *
 * Di luar panel (mis. tes di PC) dipakai port dari config / env DASHBOARD_PORT.
 */

import net from 'net';

/**
 * Panel Pterodactyl (Wings) menyuntikkan P_SERVER_UUID ke container. SERVER_PORT
 * ikut dicek sebagai cadangan untuk egg/panel turunan yang tidak meneruskan
 * variabel P_SERVER_*.
 */
function isPterodactyl() {
  return Boolean(
    process.env.P_SERVER_UUID || process.env.P_SERVER_LOCATION || process.env.SERVER_PORT,
  );
}

function toPort(value) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
}

/**
 * @returns {{ port: number|null, host: string, panel: boolean, reason?: string }}
 */
function resolvePort(dashboardConfig = {}) {
  if (isPterodactyl()) {
    const port = toPort(process.env.SERVER_PORT);
    if (!port) {
      return {
        port: null,
        host: '0.0.0.0',
        panel: true,
        reason: 'server panel tidak punya allocation port (SERVER_PORT kosong)',
      };
    }
    return { port, host: '0.0.0.0', panel: true };
  }

  const port = toPort(process.env.DASHBOARD_PORT) || toPort(dashboardConfig.port) || 3000;
  // Di PC cukup bisa dibuka dari komputer itu sendiri.
  const host = process.env.DASHBOARD_HOST || dashboardConfig.host || '127.0.0.1';
  return { port, host, panel: false };
}

/** Coba listen sebentar untuk memastikan port belum dipakai proses lain. */
function isPortFree(port, host) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => tester.close(() => resolve(true)));
    tester.listen(port, host);
  });
}

export { isPterodactyl, resolvePort, isPortFree };
