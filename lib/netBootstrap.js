/**
 * netBootstrap.js - Setelan jaringan global, WAJIB di-import paling awal.
 *
 * Panel Pterodactyl tidak punya IPv6, sedangkan api.autoresbot.com (Cloudflare)
 * punya alamat IPv4 dan IPv6. Node >= 20 memakai Happy Eyeballs
 * (autoSelectFamily) dengan batas 250ms per alamat. Saat event loop sedang
 * sibuk (biasanya bersamaan dengan reconnect WhatsApp), 250ms itu sudah habis
 * sebelum handshake TCP sempat diproses, sehingga semua alamat dianggap gagal:
 *   connect ETIMEDOUT 172.67.x.x:443; connect ENETUNREACH 2606:4700:...:443
 *
 * - ipv4first     -> alamat IPv4 dicoba lebih dulu (IPv6 selalu ENETUNREACH).
 * - 2000ms        -> beri tiap alamat waktu yang wajar walau event loop padat.
 *
 * Berlaku untuk semua klien yang memakai `net`: axios, node-fetch, fetch
 * (undici), paket api-autoresbot, dll.
 */
import dns from 'node:dns';
import net from 'node:net';

if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

if (typeof net.setDefaultAutoSelectFamilyAttemptTimeout === 'function') {
  net.setDefaultAutoSelectFamilyAttemptTimeout(2000);
}
