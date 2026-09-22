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

---

## 18. `ENOSPC: no space left on device` pada stiker (5.4.2)

**Gejala:** di sebagian panel Pterodactyl `.bratdeluxe`, `.bratcomic`,
`.bratbubble`, `.bratneon`, `.bratword`, `.bratglitch` gagal dengan
`ENOSPC: no space left on device, write`, sementara `.brat` masih jalan.
Menghapus `.npm`/`.cache`/`node_modules` lalu restart hanya menolong sementara.

**Penyebab:** berkas stiker hasil `simpanDenganExif` (di `os.tmpdir()`) tidak
pernah dihapus oleh `sendImageAsSticker` setelah terkirim. `clearDirectory('./tmp')`
di `index.js` hanya membersihkan `./tmp` proyek, bukan `/tmp` sistem. Jadi setiap
stiker (dari fitur mana pun) meninggalkan satu berkas. Selain itu `imageToWebp`,
`videoToWebp`, `gifToWebp`, dan `webpToImage` meninggalkan berkas input/output
kalau ffmpeg gagal. Stiker animasi paling cepat kena karena berkasnya paling
besar: saat disk hampir penuh, PNG kecil dari `.brat` masih muat, webp animasi
tidak. Restart menolong karena container dibuat ulang (tmpfs `/tmp` kosong) atau
kuota disk jadi lega lagi.

**Perbaikan (`lib/exif.js`):**
- helper `hapusSementara(...berkas)`: `unlinkSync` yang diam bila berkas tidak ada.
- `sendImageAsSticker` (jalur gambar & video) menghapus `stickerUrl` di `finally`
  setelah `sock.sendMessage`. Aman: zapo membaca & mengunggah berkas di dalam
  `client.message.send`, jadi setelah `await` berkasnya tidak dipakai lagi.
  Tidak ada pemanggil yang memakai path hasil kembalian.
- keempat fungsi konversi ffmpeg membersihkan input & output di `finally`.
- `simpanDenganExif` membersihkan berkas setengah jadi bila penulisan gagal.

**Error terkait `ffmpeg exited with code 1: ... Invalid data found when
processing input`:** tidak bisa terjadi di kode 5.4.1+ karena webp dialihkan ke
`webpKeStiker` tanpa ffmpeg. Di 5.4.0 `imageToWebp` memasukkan webp animasi ke
ffmpeg, yang tidak bisa men-decode-nya. Artinya panel itu memakai plugin baru
dengan `lib/exif.js` lama. Pesannya juga berasal dari fluent-ffmpeg di bot; error
ffmpeg dari API berbunyi `ffmpeg gagal (exit N)`. API (`api-secondary`) sudah
membersihkan folder temp-nya di `finally`, jadi tidak perlu diubah.

Diuji: PNG & webp animasi -> berkas ada saat dikirim, hilang sesudahnya; kirim
gagal -> berkas tetap terhapus; ffmpeg gagal (jpeg rusak) -> tidak ada sisa di
tmpdir.

---

## 19. Fitur baru: dashboard web (`dashboard/`)

Express 5 (dependensi baru `express`), dijalankan dari `index.js` setelah
`start_app()` lewat `import()` dinamis. Seluruh kegagalan hanya di-log
`[DASHBOARD] ...`; tidak ada handler proses global yang dipasang.

| File | Isi |
|---|---|
| [dashboard/index.js](dashboard/index.js) | `startDashboard()`: resolve port, tunggu bot online, pasang route |
| [dashboard/lib/port.js](dashboard/lib/port.js) | Deteksi Pterodactyl (`P_SERVER_UUID`), port dari `SERVER_PORT`, cek port bebas |
| [dashboard/lib/auth.js](dashboard/lib/auth.js) | Login password, cookie HMAC, limit 5 gagal / 10 menit per IP |
| [dashboard/lib/files.js](dashboard/lib/files.js) | `safeResolve` (anti path traversal/symlink), `node --check`, backup |
| [dashboard/routes/](dashboard/routes/) | `database.js`, `files.js`, `system.js` (status, config, log) |
| [dashboard/public/](dashboard/public/) | UI tanpa build step (HTML/CSS/JS polos) |

**Urutan start:** port di-resolve dulu (panel tanpa `SERVER_PORT` => berhenti),
lalu `express` di-import (belum terinstal => berhenti), lalu menunggu
`global.statusConnected[config.phone_number_bot] === true` + 5 detik. Kalau bot
belum online setelah 3 menit (mis. menunggu pairing), dashboard tetap jalan agar
config bisa diperbaiki. Port dicek bebas sebelum `listen`, dan error `listen`
juga ditangkap. `express@^5.1.0` dicek/diinstal saat start lewat
`checkAndInstallModules`, tapi dalam try/catch TERPISAH dari daftar module
utama: kegagalan di daftar utama membuat `index.js` memanggil `process.exit(1)`,
sedangkan gagal install express cukup melewati dashboard.

**Port:** di panel hanya `SERVER_PORT` (allocation) yang bisa diakses dari luar,
bind `0.0.0.0`. Di luar panel: `DASHBOARD_PORT` env > `config.dashboard.port` >
3000, bind `127.0.0.1` (override `DASHBOARD_HOST`).

**Keamanan:** password dari `DASHBOARD_PASSWORD`; kosong => dibuat acak dan
disimpan bersama secret HMAC di `database/dashboard.json` (gitignore). Tag hash
password ikut di token, jadi ganti password membatalkan sesi lama. Request non-GET
wajib header `X-Dashboard: 1` + cookie `SameSite=Strict` (anti CSRF). Header CSP,
`X-Frame-Options: DENY`. Semua path file dibatasi ke folder proyek.

**Database:** memakai koneksi `getDb()` yang sama dengan bot. Baris diidentifikasi
lewat `rowid` (semua tabel adalah rowid table), jadi PK gabungan (`totalchat`)
tetap bisa diedit. Nilai form dikonversi per tipe kolom; teks `NULL` => null.
Data yang di-cache bot di memori (mis. owner di `lib/users.js`) baru berubah
setelah restart.

**Simpan file:** `.js/.mjs/.cjs` dicek `node --check` pada salinan di tmpdir OS
(bukan di folder proyek, supaya tidak terbaca pemantau plugin); file editor bisa
"simpan paksa", config.js tidak. Salinan sebelum ditimpa/dihapus disimpan di
`database/_dashboard_backup/` (30 terbaru, maks 5MB/file).

Diuji (tanpa koneksi WA, status dipalsukan): login/401/403, CRUD tabel + validasi
angka, SQL console, traversal `../` & path absolut ditolak, upload/409/biner,
rename, download, hapus root ditolak, config sintaks rusak ditolak, panel tanpa
port & port terpakai => dashboard tidak jalan, proses tetap hidup.

### 19b. UI baru, form config, ganti password

**UI:** ditulis ulang, tetap tanpa framework/build step. Tema gelap neon, font
Orbitron (judul) + Rajdhani (isi) dari Google Fonts (CSP menambah
`fonts.googleapis.com` & `fonts.gstatic.com`; tanpa internet jatuh ke font
sistem). Sidebar kiri dibuka dengan hamburger: di desktop menyempit jadi ikon
(disimpan di localStorage), di layar < 1024px jadi drawer + backdrop. Profil di
kanan atas (nama = `config.owner_name`) dengan menu Ganti Password & Keluar.
Ikon SVG inline. Polling dashboard 10 detik, berhenti saat tab tersembunyi.

**Form config** ([dashboard/lib/configForm.js](dashboard/lib/configForm.js)):
`SCHEMA` berisi kategori & field; tiap field menunjuk `const NAMA` atau properti
`prop:` di objek `config`. Baca: literal dicari lalu dievaluasi di
`vm.runInNewContext` kosong (timeout 50ms); nilai bukan literal (mis.
`global.version`) tidak dimasukkan skema. Tulis: hanya span literal yang diganti,
komentar & isi lain utuh, lalu lewat `writeConfigFile` (`node --check`, cek
`export default`, backup). Server hanya menerima key yang ada di `SCHEMA` dan
memvalidasi per tipe (`phone`, `pairing` = 8 karakter `[1-9A-HJ-NP-TV-Z]`,
`number`+`min`, `select`, `list`, `map`, `secret`). Field yang tidak ada di
config.js lama tampil nonaktif. Editor mentah config dihapus dari halaman Config
(masih bisa lewat File Manager).

**Ganti password** (`POST /api/password`): wajib password lama, minimal 6
karakter. Ditulis ke `DASHBOARD_PASSWORD` di config.js; config lama tanpa
konstanta itu memakai `database/dashboard.json`. Berlaku langsung: tag password
di token berubah sehingga sesi lain logout, sesi aktif diberi cookie baru.

**Endpoint baru:** `GET /api/system/profile`; `GET /api/system/status` kini
berisi `stats` (users, premium, groups, sewa, jumlah plugin, cache 60 detik) dan
CPU/load. `GET/PUT /api/system/config` kini berbasis form (`{ values }`).

Diuji: validasi form (pairing salah, key tak dikenal, tanpa perubahan),
config ditulis dengan komentar utuh & bisa di-import ulang, password lama/pendek
ditolak, sesi lain logout setelah ganti password. Screenshot UI di 1440px & 390px
dengan API tiruan: tidak ada scroll horizontal.

**Kompatibel config.js lama** (tanpa bagian `dashboard`): `config.dashboard`
undefined => dashboard aktif, port dari `SERVER_PORT`, password otomatis di
`database/dashboard.json`. Ganti password ditulis ke `dashboard.json` dengan
`passwordChanged: true`, supaya setelah restart tidak lagi dianggap password
otomatis. Field `DASHBOARD` & `DASHBOARD_PORT` tampil nonaktif di form. Deteksi
panel kini juga menerima `SERVER_PORT` saja (egg turunan tanpa `P_SERVER_*`).
Diuji dengan `git show HEAD:config.js` + env panel tiruan: aktif di
`SERVER_PORT`, simpan form OK, ganti password bertahan setelah restart.

### 19c. Login, Custom, Strings, editor file

**Login:** `GET /api/info` (publik) memberi versi untuk judul "RESBOT MD ·
v5.4.2". Batas login jadi jendela geser: 3 password salah per IP dalam 60 detik
=> 429 `{ retryAfter }` (detik sampai kegagalan tertua keluar dari jendela). UI
mengunci tombol + hitung mundur; tombol dikunci selama request (anti double klik).

**Custom** ([dashboard/routes/custom.js](dashboard/routes/custom.js)):
`database/assets/allmenu.jpg` dan `database/audio/{pagi,siang,sore,petang,malam,sahur}.opus`.
Upload berupa body mentah; tipe dicek dari magic bytes. Gambar non-JPEG =>
JPEG lewat `sharp` (sudah ada di node_modules). Audio non-Ogg-Opus => Opus mono
48kHz 64k lewat ffmpeg dari `@ffmpeg-installer/ffmpeg` (dipakai juga oleh
sticker). `?target=all` menulis ke keenam slot. File lama di-backup. Tidak perlu
restart: `plugins/menu.js` & `lib/scheduled.js` membaca file tiap kali dipakai.

**Strings** ([dashboard/lib/stringsForm.js](dashboard/lib/stringsForm.js)):
kategori & field dibaca dari objek `const mess` (vm sandbox), jadi pesan baru
otomatis muncul. Simpan mengganti literal `kategori.key` di dalam blok
kategorinya saja; komentar utuh; lewat `writeModuleFile` (`node --check`,
backup). Perlu restart (strings.js di-import sekali).

**File:** ikon & label warna per ekstensi, `GET /api/files/raw` untuk pratinjau
gambar/audio/video. Sengaja dibatasi ke tipe media (bukan HTML/SVG), karena file
yang tampil inline di origin dashboard bisa menjalankan script dengan cookie
login. Editor: textarea transparan di atas `<pre>` ber-highlight (tokenizer
regex, isi di-escape) + nomor baris; file > 300KB tanpa highlight. Simpan
sukses menutup modal.

**Database mobile:** `.db-layout` column memakai `align-items: flex-start`, jadi
kartu selebar tabel. Di mobile diganti `stretch` sehingga tabel scroll di dalam
kartunya sendiri.

**Bug bot: `lib/scheduled.js` sahur** membaca `sahur.m4a` yang tidak pernah ada
(bawaan `sahur.opus`), jadi audio sahur selalu gagal. Sekarang pakai
`sahur.opus` dengan cadangan `sahur.m4a`.

Diuji: 3 password salah => 429 retryAfter 60, login lagi setelah 61 detik;
strings dengan newline & kutip bisa di-import ulang; PNG => JPEG valid; MP3 =>
Ogg Opus; `target=all` menulis 6 file; `/files/raw` menolak `.js`. Screenshot
login, Custom, Strings, File, editor (desktop & 390px), dan Database 390px
dengan API tiruan. Semua file asli dipulihkan setelah pengujian.

---

## 20. Startup: console lebih ringan & plugin dimuat saat sesi terhubung

**`⚠️ Gagal hapus: logs`** — `clearDirectory('./tmp')` memanggil `unlink` pada
semua entri, termasuk folder `tmp/logs` milik winston ([lib/logger.js](lib/logger.js)),
sehingga selalu gagal. Sekarang `readdir({ withFileTypes: true })` dan folder
dilewati; file yang terkunci (Windows) dilewati diam-diam, `ENOENT` diabaikan.

**Lazy load handler & plugin** — dulu `initHandlers()` dan `reloadPlugins()`
jalan saat [autoresbot.js](autoresbot.js) di-import (startup), sebelum ada sesi.
Saat menunggu pairing/QR atau sesi logout, 338 plugin tetap di-import padahal
`messages.upsert` tidak mungkin terpicu tanpa sesi `open`.

- `ensureReady()` (memoized, sekali per proses) memuat keduanya.
- Dipicu di event `connection === 'open'` ([lib/connection.js](lib/connection.js)),
  sesi utama maupun jadibot, tanpa di-await.
- `processMessage` tetap `await ensureReady()` sebagai pengaman, jadi pesan
  awal tidak lolos dari handler antilink/ban/sewa.
- Hot reload (development) hanya reload bila plugin sudah pernah dimuat.
- Log `Load All Handler/Plugins done` diganti satu baris
  `[✔] Handler & plugin dimuat (N plugin)`.

Tidak ada side effect top-level (timer/cron) di `handle/` maupun `plugins/`,
jadi menunda import aman. Diuji: import `autoresbot.js` tidak memuat apa pun,
`ensureReady()` dua kali hanya memuat sekali; `clearDirectory` menghapus file,
menyisakan `logs/`, tanpa warning, dan diam pada folder yang tidak ada.

---

## 21. `.hd` / `.tourl`: respons API ditampilkan saat gagal

Server upload (`autoresbot.com/tmp-files/upload`) dan API remini membalas
`{ status: false, message, error_code }` + HTTP 4xx, tapi plugin hanya
membalas pesan umum sehingga penyebabnya tidak terlihat.

- [lib/uploader.js](lib/uploader.js): `formatApiResponse(res)` → `HTTP 400 -
  <message> (<error_code>)`; body HTML (nginx/Cloudflare) dibersihkan & dipotong
  200 karakter. `formatNetworkError(err, target)` untuk timeout/DNS/reset.
  `uploadImageFile` kini membungkus error jaringan dan menyertakan
  `err.status` + `err.responseData`; `logShort` menyimpan body mentah
  (maks 2000 karakter) ke `logs/api.log`.
- [plugins/TOOLS/hd.js](plugins/TOOLS/hd.js): setiap titik gagal (upload,
  buat job, polling, unduh hasil, catch umum) membalas dengan `*Respon API:*`.
  Saran `.apikey` hanya bila 401/403 atau `error_code`/pesan menyebut key.
  Polling 4xx langsung berhenti (dulu diulang 10×7 detik sampai timeout).
- [plugins/TOOLS/to url.js](plugins/TOOLS/to url.js): balasan gagal memuat
  `*Respon server:*` (atau `*Detail:*` untuk error lokal).

Format `serverMessage` berubah (ada prefix `HTTP xxx -`); pemakai lain hanya
menulisnya ke log, jadi tidak terpengaruh.

---

## 22. Titik hitam kecil pada stiker `.bratdeluxe` dkk

Regresi dari bagian 10. `bersihkanSisaFrameWebp()` (pembersih sisa frame
terakhir) menyimpan hasil lewat `node-webpmux` `img.save()`, yang menulis ulang
`VP8X` webp animasi tanpa bit alpha:

```
VP8X API        : 0b00010010  (ALPHA + ANIM)
VP8X hasil bot  : 0b00001010  (EXIF + ANIM)  <- alpha hilang
```

Frame 2..n dari API berupa kotak kecil ber-`ALPH` dengan blend alpha. Data
warna (VP8) di bawah piksel ber-alpha 0 berisi nilai gelap (±140 ribu piksel
di tes "resbot tes hitam"). Pemutar yang percaya flag VP8X menggambar kotak itu
tanpa transparansi, sehingga muncul titik/garis hitam di sekitar huruf.

Perbaikan di [lib/exif.js](lib/exif.js):
- `gantiFrameTerakhir()`: frame terakhir diganti di level chunk RIFF (header
  ANMF 16 byte + chunk `VP8L`/`VP8 `/`ALPH` dari hasil sharp, flag `0x02` =
  tanpa blend). VP8X, ANIM, dan frame lain disalin apa adanya.
- `pulihkanFlagAlpha()`: bila jalur chunk gagal dan terpaksa lewat
  node-webpmux, bit alpha dari berkas asli dipasang kembali.
- `stikerCadangan()` di `sendImageAsSticker` (jalur gambar): bila
  `writeExifImg`/`imageToWebp` melempar error, stiker tetap dikirim. Untuk webp:
  apa adanya + EXIF; untuk format lain: sharp → webp 512 (tanpa ffmpeg) + EXIF;
  bila EXIF gagal: tanpa EXIF. Error hanya diteruskan bila sharp juga gagal.

Diuji dengan hasil API asli: flag hasil `00011010`, 46 frame, frame 0–44
byte-identik dengan API, frame terakhir hanya berbeda di sisa titik yang
memang dibersihkan, EXIF ada. Fallback diuji dengan ffmpeg dipaksa gagal
(exit code 1): PNG tetap terkirim 512x512 + EXIF; JPEG rusak tetap error.

---

## 23. `.qc2` pindah ke API autoresbot

`bot.lyo.su/quote/generate` (dipakai lewat [lib/scrape/quote.js](lib/scrape/quote.js))
membalas HTTP 502 untuk semua request, termasuk halaman utamanya, sehingga `.qc2`
selalu gagal. [plugins/MAKER/qc2.js](plugins/MAKER/qc2.js) kini memakai struktur
yang sama dengan [qc.js](plugins/MAKER/qc.js) dengan endpoint `/api/maker/qc2`,
tanpa `limitDeduction`. Validasi teks ikut `qc.js` (`content.trim()`), sehingga
`.qc2` kosong yang membalas pesan memakai teks pesan tersebut.

`.qcstick` masih memanggil `bot.lyo.su` langsung dan ikut gagal selama server
itu mati.

---

## 24. `.update`: retry download (HTTP 504 dari GitHub)

`serverUrl` adalah archive GitHub yang dialihkan (302) ke
`codeload.github.com`. Codeload membuat zip saat diminta (tanpa
`Content-Length`), dan gateway-nya sesekali membalas 504. Error itu tidak
berasal dari API autoresbot.

[plugins/OWNER/update.js](plugins/OWNER/update.js):
- `unduhUpdate()`: maksimal 3 percobaan, jeda 5 lalu 10 detik. Retry untuk
  5xx, 429, dan error jaringan; 4xx lain (mis. 404) langsung gagal. Owner diberi
  tahu lewat chat di tiap retry.
- `unduhSekali()`: `timeout` 60 detik untuk respons pertama + watchdog
  `AbortController` yang membatalkan bila stream tidak mengirim data 60 detik.
  Error pada stream respons kini ditangani (dulu hanya error `WriteStream`,
  sehingga koneksi putus di tengah membuat promise menggantung).
- Validasi tanda tangan zip (`PK`) sebelum extract.
- `jelaskanError()`: 504/502/503/429/404/DNS dijelaskan dalam bahasa owner.
- Saat gagal, `update.zip` dan `update_temp/` dihapus. `update.lock` dibuat
  paling akhir, jadi kegagalan tidak memicu apply setengah jadi saat restart.

Diuji dengan server HTTP lokal tiruan (tanpa menjalankan `.update`): 504 dua
kali lalu zip → sukses di request ke-3; 504 terus → gagal setelah 3 request;
404 → gagal setelah 1 request; respons HTML → ditolak sebagai zip tidak valid.
Tidak ada file sisa di semua skenario. Watchdog "macet 60 detik" belum diuji.
