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
| Stiker animasi gagal / terkirim diam (`.bratdeluxe`) | webp animasi dipaksa di-encode ulang ffmpeg (tidak bisa decode webp animasi), lalu `isAnimated` tak pernah terisi karena zapo cuma membaca 100 byte pertama | `lib/exif.js` |
| Stiker tidak bisa disimpan penerima | `isAiSticker: true` + `premium: 1` ikut terkirim — WhatsApp melarang stiker AI disimpan. Plus ukurannya 320×320 (standar: 512×512) dan `sticker-pack-id` dipatok sama untuk semua paket | `lib/exif.js` |
| Spam `Gagal mengambil metadata` di banyak grup | cache diisi **setelah** `await` → pesan bersamaan di grup sama menembak query masing-masing; kegagalan tidak dicatat → tiap pesan berikutnya mencoba lagi. Kini permintaan digabung + jeda gagal 1 menit + log diredam | `lib/cache.js`, `lib/utils.js` |
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

---

## 10. Stiker animasi kehilangan transparansi (border putih)

Stiker animasi (mis. `.bratdeluxe`) sampai di WhatsApp dengan latar/border putih
yang tidak ada pada berkas dari API.

Penyebabnya bukan resize maupun ffmpeg — pipa untuk sumber webp 512x512 memang
tidak menyentuh piksel. Yang merusak adalah penulisan metadata paket:
`node-webpmux` membongkar-pasang berkas pada `img.save()`, dan untuk webp
**animasi** ia menulis ulang header `VP8X` tanpa bit alpha:

```
VP8X flags asli   : 0b00010010  (ALPHA + ANIM)
VP8X flags setelah: 0b00000010  (ANIM saja)
```

Pikselnya tetap identik, tapi pemutar yang membaca flag itu menganggap stiker
tidak punya transparansi, sehingga area transparan dirender putih.

`lib/exif.js` sekarang menyisipkan EXIF langsung di level chunk RIFF
(`sisipkanExif()`): chunk gambar disalin apa adanya, hanya bit EXIF pada `VP8X`
yang dinyalakan dan satu chunk `EXIF` ditambahkan di akhir. Jalur
`node-webpmux` dipertahankan sebagai cadangan untuk webp sederhana tanpa `VP8X`
(mis. VP8L), bentuk yang memang tidak bermasalah.

Diuji untuk png, jpg, webp lossy, webp lossless, webp animasi dari API, dan
video → stiker: EXIF terbaca, ukuran 512x512, dan piksel webp animasi
byte-identik dengan sumbernya.

---

## 11. Preview media kosong sebelum diunduh

WhatsApp menampilkan gambar kecil yang blur sebelum media diunduh penerima.
Gambar itu ikut dikirim di dalam pesan sebagai `jpegThumbnail`. Baileys
membuatnya sendiri; zapo **tidak** — ia hanya menyediakan antarmuka
`WaMediaProcessor` dan memakainya bila diisi (`shouldGenerateThumbnail` di
`zapo-js/dist/client/media.js`). Karena bot belum pernah mengisi
`media.processor`, semua gambar/video terkirim tanpa thumbnail.

- `lib/zapo/mediaProcessor.js` (baru): `generateImageThumbnail`,
  `generateVideoThumbnail` (satu frame lewat ffmpeg), dan
  `generateStickerThumbnail`. `sharp` dipakai lebih dulu, `jimp` sebagai
  cadangan kalau modul native-nya gagal dimuat di panel.
- `lib/connection.js`: diteruskan ke `WaClient` lewat `media: { processor }`.
- `plugins/menu.js`: `imageMessage` di menu interaktif dirakit sendiri sebagai
  proto mentah, jadi tidak lewat media processor — thumbnailnya diisi manual
  lewat `buatThumbnailJpeg()`.

Diuji lewat `runMediaProcessor` milik zapo: image menghasilkan
`jpegThumbnail` + dimensi asli, video menghasilkan `jpegThumbnail`, sticker
menghasilkan `pngThumbnail`; dan `jpegThumbnail` terbukti bertahan pada
encode/decode proto `interactiveMessage`.

### Efek samping yang ikut ketahuan: menu interaktif tidak pernah jalan

`sendInteractiveMenu()` memakai `proto.Message.InteractiveMessage.create({...})`
gaya protobufjs (Baileys). Encoder proto zapo ditulis tangan dan tidak punya
helper `create()`, jadi pemanggilannya **selalu** melempar
`create is not a function` — tertangkap `try/catch` dan diam-diam turun ke
fallback gambar biasa. Sekarang pesannya dirakit sebagai objek biasa, dan
menu interaktif (tombol "Join Channel") berfungsi seperti yang diniatkan.

---

## 12. `AUTO_READ` tidak jalan di grup

`sock.readMessages()` mengirim receipt lewat bentuk
`client.message.sendReceipt(jid, ids, { type: 'read' })`. Bentuk itu tidak
membawa `participant`, padahal receipt untuk chat **grup** dan **broadcast**
wajib menyebut pengirim pesan aslinya — lihat `needsParticipant()` di
`zapo-js/dist/client/events/receipt.js`. Tanpa atribut itu receipt grup
diabaikan server, jadi `AUTO_READ = true` hanya terasa di chat pribadi.

`lib/zapo/socket.js` sekarang meneruskan key sebagai *event* ke overload
`sendReceipt(events, options)`, sehingga zapo sendiri yang menurunkan
`participant` (termasuk device pengirim) dan mengelompokkan id per chat.
Key yang sudah dipreteli pemanggil (hanya `remoteJid` + `id`) tetap aman:
`isGroup`/`isBroadcast` dihitung ulang dari jid-nya.

Diuji dengan menjalankan `WaMessageCoordinator.prototype.sendReceipt` asli
dari zapo memakai bentuk key yang dipakai bot:

```
62812@s.whatsapp.net | ids A1    | participant undefined
123-456@g.us         | ids B1,B2 | participant 999@lid
123-456@g.us         | ids C1    | participant 777@lid
```

`lib/connection.js` juga membungkus autoread dengan try/catch sendiri:
sebelumnya error receipt melompat ke catch pemrosesan pesan, sehingga satu
receipt gagal ikut membatalkan eksekusi command.

---

## 13. Admin baru masih terbaca sebagai user biasa

Metadata grup di-cache 60 menit (`CACHE_METADATA` di `lib/cache.js`), dan
`updateParticipant()` yang dipanggil dari event `group-participants.update`
seharusnya menyegarkan status admin di cache itu. Pencocokan pesertanya
memakai satu field saja:

```js
const index = group.participants.findIndex((gp) => gp.id.split('@')[0] === targetNumber);
```

Di grup ber-alamat **LID**, `gp.id` berisi `69243815079978@lid` sementara event
promote/demote mengirim nomor telepon `6285246154386@s.whatsapp.net`
(`lib/zapo/socket.js` memang memprioritaskan `phoneJid`). Nomornya berbeda,
`index` selalu `-1`, dan promote/demote tidak pernah diterapkan — status admin
lama bertahan sampai TTL 60 menit habis.

Perbaikan di `lib/cache.js`:

- `nomorDari()` mengambil bagian nomor dari jid apa pun, termasuk membuang
  penanda device (`628xx:12@s.whatsapp.net`).
- `pesertaCocok()` membandingkan target dengan **semua** identitas peserta:
  `id`, `jid`, `lid`, `phoneNumber`.
- promote/demote yang pesertanya tetap tidak ketemu kini membuang cache grup
  (`clearGroupCache`), sehingga permintaan berikutnya mengambil data segar
  alih-alih menyimpan status yang salah selama satu jam.
- `pesertaAdalahAdmin()` diekspor sebagai pengecekan admin bersama; dipakai
  `checkIfAdmin()` di `lib/utils.js` dan pengecekan admin untuk user yang
  di-mention di `handle/usersHandle.js` (sebelumnya `participant.id === mention`
  saja, yang selalu meleset di grup LID).

Diuji dengan cache grup tiruan bergaya LID:

```
sebelum promote : false
sesudah promote : true      (event datang sebagai nomor telepon)
lewat LID juga  : true
sesudah demote  : false
ambil ulang saat peserta tak dikenal? true
```

plus helper-nya sendiri: nomor ber-device suffix cocok, bukan anggota /
input kosong / participants null semuanya `false`.

---

## 14. `antilink` ikut menghapus link grup & saluran WhatsApp

`antilink` dan `antilinkv2` memakai `isUrlInText()` yang menangkap URL apa pun,
termasuk `chat.whatsapp.com/...` dan `whatsapp.com/channel/...`. Padahal kedua
jenis link itu sudah punya penangan sendiri (`antilinkwa`/`antilinkwav2` dan
`antilinkch`/`antilinkchv2`), sehingga menyalakan `antilink` saja membuat
setelan antilinkwa/antilinkch tidak ada artinya.

`lib/utils.js` menambah:

- `daftarUrl(str)` — semua URL dalam teks (pola longgar yang sama seperti
  sebelumnya, kini dipakai bersama).
- `isLinkGrupAtauSaluranWa(url)` — link undangan grup / saluran WhatsApp.
- `isUrlInTextSelainWa(str)` — ada URL **selain** keduanya. Teks yang hanya
  memuat link grup/saluran bernilai `false`, tapi teks campuran tetap `true`
  karena link non-WhatsApp-nya memang harus kena antilink.

`handle/MODE ON/handler.js` memakai `isUrlInTextSelainWa()` untuk `antilink`
dan `antilinkv2`; devlog `cekAntilink` sekarang menampilkan `isUrlSelainWa`
di samping `isUrl` supaya selisihnya terlihat saat menelusuri masalah.

Diuji 12 kasus: link grup/saluran dengan dan tanpa skema/`www`, link grup yang
disisipkan di tengah kalimat, campuran link grup + link biasa, teks tanpa link,
`whatsapp.com/channelxxx` (bukan saluran, tetap kena), `wa.me` (tetap link
biasa — `antilinkwa` hanya menangani link undangan grup), serta input
non-string. Semua lulus.

---

## 15. Fitur baru: alarm grup (`.addalarm` / `.alarm` / `.delalarm`)

Pesan terjadwal harian per grup, hanya untuk admin grup & owner.

**Berkas**

- `lib/alarm.js` (baru) — parser format perintah, CRUD SQLite, dan penjadwalan.
- `plugins/ADMIN/alarm.js` (baru) — tiga perintah dalam satu berkas;
  `MenuCommands` membatasi yang tampil di menu ke `addalarm`, `alarm`,
  `delalarm` (sisanya alias: `listalarm`, `hapusalarm`).
- `lib/database.js` — tabel `alarms` + unique index `(group_id, name)`, jadi
  nama yang sama di satu grup berarti **memperbarui**, bukan menggandakan.

**Format**

```
.addalarm nama | pesan | HH:MM | --tagall
```

Parsernya sengaja toleran terhadap urutan: opsi dipanen dari awalan `--` di
mana pun letaknya (menempel di jam, berdiri sendiri, atau di baris terpisah
seperti contoh di permintaan), jam dikenali dari bentuknya (`06:00`, `6:00`,
`06.00`), potongan pertama yang tersisa jadi nama dan sisanya digabung jadi
pesan — sehingga tanda `|` di dalam pesan tidak menghilangkan isinya. Opsi yang
dikenali dibatasi daftar tertutup (`--tagall`/`--tag`/`--tagsemua`,
`--hidetag`/`--sembunyi`) supaya `--` lain di dalam pesan tidak ikut terbuang.

**Penjadwalan**

`node-schedule` dengan `{ rule, tz: 'Asia/Jakarta' }` — jam yang diketik admin
selalu WIB, tidak peduli zona waktu server (panel umumnya UTC). `syncAlarm()`
memegang daftar job-nya sendiri sehingga bisa dibatalkan tanpa menyentuh job
lain, dan dipanggil dari tiga tempat: saat koneksi terbuka (`lib/connection.js`),
di akhir `updateSocket()` (`lib/scheduled.js` membatalkan SEMUA job sebelum
menjadwalkan ulang miliknya), dan setiap kali admin menambah/menghapus alarm.
Alarm sengaja tidak bergantung pada `config.scheduled`, karena itu setelan
global sementara alarm dipasang manual oleh admin grup.

**Batas & perilaku aman**

Maksimal 20 alarm per grup, pesan maksimal 2000 karakter. Bila metadata grup
gagal diambil saat alarm berbunyi, pesannya tetap dikirim tanpa tag; kegagalan
kirim (mis. bot sudah keluar grup) dicatat dan tidak menjatuhkan penjadwal.

**Diuji**

Parser 9 kasus termasuk contoh asli dari permintaan dan `| 21:00 --tagall`
(opsi menempel di jam); `normalkanWaktu` menolak `24:00`, `6:60`, `pagi`;
CRUD (simpan, timpa nama sama, hapus per nomor/nama/all, nama tak dikenal);
penjadwalan 3 alarm — `nextInvocation()` semuanya jatuh di jam WIB yang benar
dan job hilang setelah alarm dihapus; pengiriman untuk ketiga mode tag;
fallback saat metadata gagal; dan `sendMessage` yang melempar tidak
mematikan job. `addalarm`, `alarm`, `delalarm` terverifikasi muncul di menu
kategori admin.

Daftar `.alarm` sengaja ringkas — satu baris per alarm (nomor, nama, jam, dan
ikon mode tag), tanpa isi pesan, supaya tetap pendek walau alarmnya banyak:

```
1. *pagi* — 06:00 WIB 📢
2. *siang* — 12:00 WIB 💬
3. *malam* — 22:00 WIB 🔕
```

---

## 16. `.del` gagal menghapus pesan anggota

`plugins/ADMIN/delete.js` mengirim perintah hapus tanpa `fromMe`:

```js
delete: { remoteJid, id: isQuoted.id, participant: isQuoted.sender }
```

zapo memakai `key.fromMe` apa adanya saat merakit `protocolMessage` REVOKE
(`targetMessageKey()` -> `buildMessageKey()` di
`zapo-js/dist/client/messaging/messages.js`). Ketika field itu tidak ada,
penerima mencari pesan milik PENGIRIM perintah dengan id tersebut — jadi
menghapus pesan bot sendiri kebetulan berhasil, sedangkan pesan anggota lain
tidak pernah ketemu dan gagal diam-diam. Catatan yang sama sudah ada di
`handle/MODE ON/handler.js` (antilink/antidelete memang menyetel
`fromMe: false` eksplisit, dan penghapusannya bekerja).

Perbaikan:

- `fromMe` dihitung dari pemilik pesan yang dikutip: identitas bot diambil dari
  kredensial zapo (`meJid` + `meLid`), `sock.user.id`, dan
  `global.phone_number_bot`, lalu dibandingkan lewat `nomorDari()` supaya bentuk
  @lid maupun nomor telepon sama-sama cocok.
- Menghapus pesan orang lain adalah *admin revoke*, jadi bot sendiri harus
  admin. Kondisi itu dicek lebih dulu dan dijawab dengan pesan yang jelas.
- Pengecekan admin pemanggil memakai `pesertaAdalahAdmin()` (sebelumnya
  `p.id === sender` saja — meleset di grup ber-alamat LID).
- Kegagalan hapus kini menampilkan pesan error aslinya, bukan "silakan coba
  lagi".

`nomorDari()` diekspor dari `lib/cache.js` untuk keperluan ini.

Diuji dengan grup tiruan: pesan anggota + bot admin -> `fromMe=false` terkirim;
pesan anggota + bot bukan admin -> peringatan, tidak ada revoke; pesan bot
(bentuk @lid maupun nomor) -> `fromMe=true`; tanpa quoted -> instruksi balas
pesan; pemanggil bukan admin -> ditolak; `sendMessage` yang melempar ->
pesan error aslinya tersampaikan.

---

## 17. `.iqc` dan error `sendMessage requires registered meJid`

Error itu dilempar zapo di `requireCurrentMeJid()`
(`WaMessageDispatchCoordinator.js:1524`) ketika kredensial sesi sedang kosong —
yang terjadi saat socket putus / sedang reconnect sementara pesan yang sudah
terlanjur masuk masih diproses. Setiap pengiriman pada saat itu gagal,
**termasuk pengiriman pesan error di blok catch plugin**; error kedua itulah
yang lolos ke `processMessage` sehingga di console hanya terlihat
"Kesalahan di processMessage: ... sendMessage requires registered meJid",
tanpa petunjuk plugin mana yang bermasalah.

Perbaikan berlapis:

- `lib/zapo/socket.js` — `sock.sessionReady()`: benar/salah apakah kredensial
  (`meJid`) tersedia untuk mengirim.
- `autoresbot.js` — `processMessage()` berhenti lebih awal saat sesi belum siap,
  dengan log yang dibatasi satu kali per chat per menit. Ini menutup seluruh
  kelas error tersebut untuk SEMUA plugin, bukan cuma `.iqc`.
- `plugins/MAKER/iqc.js` — semua pengiriman lewat `kirimAman()`: kegagalan
  dicatat satu baris dan tidak pernah merambat keluar.

Sekalian pengerasan `.iqc`:

- Foto profil diambil lewat `getProfilePictureUrl()` (yang sudah punya fallback
  foto default) dan dibungkus try/catch sendiri — bila tetap gagal, kartu chat
  tetap dibuat tanpa avatar, bukan membatalkan perintah. `name`/`pp` dikirim ke
  endpoint hanya bila tersedia.
- Balasan API diperiksa dengan `file-type` sebelum dikirim: kalau server membalas
  JSON error berstatus 200, isinya dicatat ke log dan pengguna diberi pesan yang
  jelas, bukan "gambar" rusak yang ditolak WhatsApp.
- `getWaktuIndonesia()` dipakai sekali untuk `chatTime` dan `statusBarTime`
  (dulu dipanggil dua kali, dan ada fungsi `randomTime()` yang tidak terpakai).

**Catatan penting:** `.iqc` sebelumnya memang TIDAK memakai foto profil sama
sekali. Diuji langsung ke endpoint `/api/maker/iqc` dengan dan tanpa `name`+`pp`:
hasilnya identik (401612 byte), jadi endpoint itu mengabaikan kedua parameter —
avatar di kartu chat memang digambar buram oleh server. Parameternya tetap
dikirim (tidak berbahaya, siap kalau server mendukungnya nanti), tapi kalau yang
diharapkan adalah avatar asli seperti `.qc`, itu perlu dukungan dari sisi API.

Diuji: sesi mati total (semua `sendMessage` melempar) -> perintah selesai tanpa
melempar keluar; foto profil gagal -> gambar tetap terkirim; input kosong ->
pesan format; `sessionReady()` benar untuk kredensial ada/tidak ada.
