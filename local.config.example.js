/*
Contoh override lokal. Salin file ini menjadi local.config.js lalu isi
pengaturan yang ingin diganti di komputer Anda. local.config.js tidak ikut
ke git, dan jika file itu tidak ada bot tetap memakai config.js seperti biasa.

Key mengikuti object `config` di config.js (bukan nama konstanta di atasnya),
contoh: NOMOR_BOT -> phone_number_bot, MODE -> mode.
Hanya key yang ditulis yang diganti; object di dalamnya (PANEL, SPAM,
dashboard, dst.) digabung per key, sedangkan array diganti utuh.
*/

export default {
  // phone_number_bot: '628xxxxxxxxxx',
  // owner_number: ['628xxxxxxxxxx'],
  // APIKEY: 'apikey_xxx',
  // mode: 'development',
  // dashboard: { enabled: true, port: 3000 },
};
