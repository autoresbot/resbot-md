# Migrasi Baileys → zapo-js

`zapo-js@1.8.2` menggantikan `baileys@7.0.0-rc14`.

---

## 1. Pendekatan

zapo bukan drop-in replacement: nama method, model event, dan penyimpanan auth
semuanya berbeda. Karena ada **1.215 pemanggilan `sock.sendMessage`** di **359
file**, mengubah tiap pemanggil tidak realistis.

Yang dipakai: **lapisan adapter** — satu objek `sock` yang meniru API Baileys
tapi di dalamnya memanggil `WaClient` milik zapo. **Plugin tidak diubah**,
mereka tetap memanggil `sock.sendMessage(jid, { text })` seperti dulu.

| File baru | Isi |
|---|---|
| [lib/zapo/socket.js](lib/zapo/socket.js) | Facade `sock` gaya Baileys di atas `WaClient` |
| [lib/zapo/content.js](lib/zapo/content.js) | Penerjemah konten Baileys → union `{ type: … }` zapo |
| [lib/zapo/store.js](lib/zapo/store.js) | Store SQLite per sesi (pengganti `useMultiFileAuthState`) |
| [lib/zapo/migrate.js](lib/zapo/migrate.js) | Konversi sesi Baileys lama → store zapo |
| [lib/zapo/websocket-polyfill.js](lib/zapo/websocket-polyfill.js) | `globalThis.WebSocket` untuk Node < 22 |
| [lib/devlog.js](lib/devlog.js) | Logging development (lihat bagian 5) |

Perubahan di luar `lib/zapo/` sebagian besar hanya penyesuaian nama field.
Alasan tiap perbaikan ditulis sebagai komentar di kode yang bersangkutan.

---

## 2. Sesi & rollback

Migrasi sesi Baileys lama berjalan otomatis saat bot start, dan **auth lama
dicadangkan** ke `session-baileys-backup-<timestamp>/` (di luar folder sesi)
sebelum apa pun disentuh.

Rollback:

```bash
git checkout -- .
npm install baileys@^7.0.0-rc14
```

lalu kembalikan auth-nya:

```js
import { restoreBaileysBackup } from './lib/zapo/migrate.js';
restoreBaileysBackup('session-baileys-backup-<timestamp>', 'session');
```

> ⚠️ Migrasi sesi lama **pernah gagal** (9 Sep 2026): autentikasi lolos, lalu
> WhatsApp melepas device-nya sendiri (`stream_error_device_removed`) dan zapo
> otomatis menghapus store. Penyebab pastinya tidak bisa dipersempit tanpa
> menautkan device lagi. **Untuk sesi baru, pairing dari awal saja** — itu
> melewati seluruh jalur migrasi.

---

## 3. Batasan yang masih ada

**Thumbnail / durasi / waveform media hilang.** `@zapo-js/media-utils` tidak
bisa dipasang: butuh `file-type >= 19`, project terkunci di `16.5.4`. Media tetap
terkirim dan bisa dibuka, hanya pratinjaunya polos. Untuk memperbaikinya,
`file-type` harus dinaikkan ke v19+ (ESM-only, API berubah — perlu penyesuaian
di [lib/utils.js](lib/utils.js)).

**LID → nomor telepon bergantung cache.** zapo hanya menyediakan arah nomor →
LID. Arah sebaliknya dilayani cache in-memory yang diisi dari pesan masuk dan
metadata grup. Konsekuensinya: **kosong setiap restart** dan terisi ulang
sendiri. LID yang belum pernah terlihat mengembalikan `null`.
→ Paling rawan: deteksi owner/premium di grup **tepat setelah restart**.

**Hasil `sock.sendMessage` minimal.** Hanya `{ key: { id }, message, status }`,
bukan objek pesan lengkap ala Baileys.

---

## 4. Checklist uji manual

Belum semua diuji terhadap WhatsApp sungguhan. Tandai sambil jalan.

**Pesan**
- [ ] Teks, mention, reply/quoted
- [ ] Gambar + caption (dari Buffer **dan** URL http)
- [ ] Video, audio, voice note (`ptt`), sticker, dokumen
- [ ] Reaksi, hapus pesan, polling, lokasi, kontak

**Koneksi**
- [ ] Pairing code & QR
- [ ] Reconnect (alasan disconnect kini berupa string, bukan angka)
- [ ] Bot tidak minta pairing ulang setelah putus-nyambung

**Grup**
- [ ] `.add` / `.kick` / `.promote` / `.demote`
- [ ] `.open` / `.close`, link invite, keluar grup
- [ ] Welcome/leave, anticall

**Lainnya**
- [ ] Menu interaktif (tombol) + fallback-nya
- [ ] `.jadibot` / `.stopjadibot`, beberapa jadibot bersamaan
- [ ] Upload status grup (`.upswgc`)
- [ ] `.clearchat` — daftar chat baru terisi setelah bot menerima pesan

---

## 5. Logging development

`logs/dev/*.jsonl` merekam data yang benar-benar lewat: pesan masuk, hasil
pengiriman, deteksi admin, dan keputusan handler. Bug migrasi di project ini
hampir selalu gagal **diam** — tanpa error, cuma tidak terjadi apa-apa — jadi
log ini yang membedakan menebak dari mengetahui.

Nyalakan: `MODE = 'development'` di config.js, atau `DEV_LOG=1 npm start`.
Panduan + contoh perintah grep: [logs/dev/README.md](logs/dev/README.md).

---

## 6. Bug yang sudah diperbaiki

Sebab lengkap tiap poin ada di komentar kode pada file terkait.

| Gejala | Sebab | Perbaikan di |
|---|---|---|
| `global WebSocket is not available` | Node 20 belum punya `WebSocket` global | `lib/zapo/websocket-polyfill.js` |
| Kode pairing tak pernah muncul (hanya loading) | menunggu `auth_pairing_required`, padahal event itu hanya dipancarkan saat me-refresh sesi pairing yang **sudah ada** — jadi saling menunggu. Pemicu yang benar: `auth_qr` pertama | `lib/connection.js`, `plugins/OWNER/jadibot.js` |
| `custom pairing code contains invalid character` | alfabet WhatsApp membuang `0`, `I`, `O`, `U`; dulu baru ketahuan setelah handshake | validasi startup di `lib/utils.js` |
| `status.buildMessageContent is not a function` | API yang ada di berkas **tipe** tapi tidak diekspos saat **runtime** — media kini diunggah manual lalu proto dirakit sendiri | `plugins/OWNER/upswgc.js` |
| `profile.queryLidsByPhoneJids` tidak ada | sama: hanya ada di tipe. Nama runtime-nya `getLidsByPhoneNumbers` | `lib/zapo/socket.js` |
| `Bentuk konten tidak dikenali: … groupStatusMessageV2` | deteksi proto mentah menebak lewat akhiran nama field ("…Message"), meleset untuk `groupStatusMessageV2` / `messageContextInfo` | `lib/zapo/content.js` |
| Bot diam total, console sepi | zapo memakai `timestampSeconds`, serializer membaca `messageTimestamp` | `lib/zapo/socket.js` |
| `reading 'split'` saat ada yang keluar grup | `jid` peserta opsional di event zapo | `lib/zapo/socket.js` |
| `type` pesan salah | `Object.keys()[0]` mengambil `messageContextInfo` | `lib/serializeMessage.js` |
| `mimetype is required` | zapo mewajibkan mimetype, Baileys mendeteksi sendiri | `lib/zapo/content.js` |
| Admin selalu ditolak | zapo pakai `isAdmin`/`jid`, bukan `admin`/`id` | `lib/zapo/socket.js` |
| `.jpm` tidak terkirim ke siapa pun | `isCommunity` tak ada → `undefined == false` bernilai false | `lib/zapo/socket.js` |
| `.creategrub` error `indexOf` | `groupCreate` belum dinormalkan | `lib/zapo/socket.js` |
| `.sewabot` / `.inspect` timeout | server grup zapo `g.us`, Baileys `@g.us` | `lib/zapo/socket.js` |
| `.inspect` semua data undefined; `.sewabot` menyimpan `undefined@g.us` | hasil IQ dibaca mentah lewat `res.content[0].attrs`, bentuk node zapo berbeda → diganti parser resmi `groupGetInviteInfo()` | `inspect.js`, `sewabot.js`, `tambah sewa.js`, `addpremgrub.js` |
| `.setppbot` timeout | `target` hanya untuk grup + gambar perlu 640×640 JPEG | `lib/zapo/socket.js` |
| `message has no downloadable media` | zapo mau `Proto.IMessage`, bukan `{ key, message }` | `lib/utils.js` |
| Pesan tidak terkirim karena mention rusak | regex `@(\d{0,16})` membolehkan nol digit | `lib/utils.js` |
| Tag tampil `@+225 …` bukan nama | domain mention ditebak dari tipe **pengirim** | `lib/utils.js` |
| Menu duplikat / label jelek | semua alias ditampilkan; `Commands[0]` sering singkatan | `database/menu.js` |

**Bukan bug:** `.sendmoney` menolak dengan `insufficient` memang benar — saldo
pengirim 9, dikirim 100.

> Catatan data: dari 39 record user, 20 berbasis `@lid` dan 19 `@s.whatsapp.net`,
> dan **semua record `@s.whatsapp.net` bersaldo 0**. Saldo asli hanya ada di
> record LID. Ini kondisi lama, bukan akibat migrasi — tapi berguna diingat
> kalau ada laporan "saldo hilang".

---

## 7. Menu: `MenuCommands`

Plugin bisa menentukan apa yang tampil di `.menu` / `.allmenu`:

```js
MenuCommands: "all"        // semua Commands (mis. anime.js: waifu, neko, hug, …)
MenuCommands: ["a", "b"]   // tepat yang disebut
// tidak diisi            → satu saja: alias yang cocok dengan nama berkas,
//                          kalau tidak ada baru Commands[0]
```

Alias lain tetap bisa diketik user — dispatch memakai `plugin.Commands`, tidak
lewat data menu.

---

## 8. Tambahan di `config.js` (opsional)

Migrasi ini menambah **satu** key: `OWNER_NAMES` — nama tampilan untuk `.owner`,
supaya tidak lagi tampil "Owner 1", "Owner 2".

```js
const OWNER_NAMES = {
  '69243815079978@lid': 'Azhari',
  '231911473578043': 'Autoresbot',
};
```

**Config lama tetap aman.** Key ini opsional; kalau tidak ada, `.owner` jatuh ke
`OWNER_NAME` (bila ownernya cuma satu) lalu ke nomornya sendiri. Sudah diuji
dengan config tanpa `owner_names` **dan** dengan nilai yang salah bentuk
(`null`, string, array, angka, objek bernilai non-string) — semuanya jatuh ke
fallback tanpa error.

Key `pairing_code` juga aman kosong/tidak ada: validasinya hanya berjalan bila
nilainya diisi.

---

## 9. Instalasi di panel

`better-sqlite3` adalah modul native dan sering gagal di Pterodactyl. Bot kini
memperbaikinya sendiri saat start. Analisis + langkah manual:
[docs/troubleshooting-panel.md](docs/troubleshooting-panel.md).
