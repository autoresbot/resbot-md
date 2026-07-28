# Arsitektur Internal

Peta cara kerja bot dari pesan masuk sampai balasan terkirim. Dokumen ini
deskriptif — menjelaskan sistem **apa adanya**, bukan sistem yang diinginkan.

---

## 1. Entry Point & Urutan Boot

```
index.js
 ├─ import './lib/version.js'          -> set global.version dari version.txt
 ├─ cek Node >= 20 (kalau tidak: exit setelah 60 detik)
 ├─ process.env.TZ = 'Asia/Jakarta'
 ├─ import config.js
 ├─ clearDirectory('./tmp')            + setInterval tiap 3 jam
 ├─ checkAndInstallModules([...])      -> BISA menjalankan npm install
 ├─ plugins/OWNER/update.js applyUpdateIfExists()
 ├─ lib/database.js initDatabase()     -> buka SQLite, buat tabel, migrasi
 ├─ lib/startup.js start_app()
 │   ├─ showServerInfo()               -> banner + cek APIKEY (exit kalau 403)
 │   └─ connectToWhatsApp()            -> lib/connection.js  ⚠ TIDAK di-await
 └─ pasang handler uncaughtException / unhandledRejection / SIGTERM / SIGINT
```

`autoresbot.js` dimuat sebagai efek samping dari `lib/connection.js`
(`import { processMessage, participantUpdate } from '../autoresbot.js'`). Saat
modul itu dievaluasi, ia langsung:

- memanggil `handler.initHandlers()` (⚠ tanpa `await`),
- memanggil `reloadPlugins()` (⚠ tanpa `await`, hasilnya di-assign di `.then`),
- memasang watcher chokidar untuk hot-reload **hanya bila `mode === 'development'`**.

**Konsekuensi:** ada jendela waktu singkat saat start di mana `plugins` masih
array kosong dan `handlers` masih kosong. Pesan yang masuk pada jendela itu
akan lolos tanpa diproses. Dalam praktiknya jendela ini tertutup jauh sebelum
koneksi WhatsApp terbuka, jadi belum pernah jadi masalah nyata.

## 2. Flow Pesan Masuk

```
Baileys 'messages.upsert'                       lib/connection.js
  └─ serializeMessage(m, sock)                  lib/serializeMessage.js
       ├─ buang pesan > 60 detik / type 'append' / broadcast / poll update
       ├─ tentukan sender, senderLid, isGroup, quoted, mention, dst
       ├─ normalisasi teks -> command + prefix + content
       └─ return messageInfo  (null = pesan diabaikan)
  ├─ (opsional) sock.readMessages   bila config.autoread
  ├─ (opsional) sock.sendPresenceUpdate
  └─ processMessage(sock, messageInfo)          autoresbot.js
       ├─ handler.preProcess(sock, messageInfo) lib/handler.js
       │     -> jalankan semua handle/*.js berurutan menurut priority
       │     -> handler yang return false MENGHENTIKAN pemrosesan pesan
       ├─ rate limit per remoteJid (config.rate_limit, owner dikecualikan)
       ├─ logging chat
       ├─ filter bot_destination (group / private / both)
       ├─ loop seluruh plugin:
       │     if (plugin.Commands.includes(command))
       │       ├─ cek OnlyPremium -> balas mess.general.isPremium
       │       ├─ cek OnlyOwner   -> balas mess.general.isOwner
       │       ├─ cek premium grup (settingGroups.fitur.premium)
       │       ├─ potong limit (plugin.limitDeduction)
       │       └─ await plugin.handle(sock, messageInfo)
       └─ bila command tidak ketemu & config.commandSimilarity:
             saran command terdekat (levenshtein, jarak <= 3)
```

### Bentuk `messageInfo`

Object ini adalah **API internal paling penting** di proyek ini — dikonsumsi
oleh 332 plugin dan seluruh handler. Mengubah nama field-nya = breaking change
massal.

| Field | Isi |
| --- | --- |
| `id` | ID pesan WhatsApp |
| `timestamp` | `messageTimestamp` mentah |
| `sender` | JID pengirim (di grup: `participantAlt`/`participant`) |
| `senderLid` | Identitas LID pengirim — **ini yang dipakai untuk lookup user** |
| `senderType` | `'user'` \| `'lid'` \| `'user-old'` \| `'group'` \| `'unknown'` |
| `pushName` | Nama tampilan pengirim |
| `isGroup`, `fromMe`, `remoteJid` | Konteks percakapan |
| `type` | Tipe pesan yang sudah dinormalisasi (`text`, `image`, `sticker`, …) |
| `content` | Isi pesan **setelah** token command dibuang (newline dipertahankan) |
| `fullText` | Teks yang sudah dinormalisasi (whitespace dijadikan satu spasi) |
| `prefix`, `command` | Hasil parsing prefix & command (lowercase) |
| `message` | Object pesan Baileys mentah (dipakai untuk `{ quoted: message }`) |
| `isQuoted`, `quotedMessage` | Info pesan yang di-reply |
| `mentionedJid` | Array JID yang di-mention, atau `false` |
| `isBot`, `isTagMeta`, `isForwarded`, `isTagSw`, `isTagSwGc` | Flag deteksi |
| `m` | Bundel `{ remoteJid, key, message, sock, isDeleted, isEdited, m }` untuk `reply(m, text)` |

## 3. Flow Handler (`handle/`)

- Dimuat rekursif oleh `lib/handler.js` saat start, diurutkan menurut `priority`
  menaik (angka kecil = jalan duluan).
- Kontrak: `export default { name, priority, process }`.
- `process(sock, messageInfo)` mengembalikan:
  - `false` → **stop total**, plugin tidak akan dijalankan;
  - nilai lain (termasuk `undefined`) → lanjut ke handler berikutnya.
- Error di dalam satu handler ditangkap, dicatat lewat `logHandlerError()`,
  dan pemrosesan tetap lanjut ke handler berikutnya.

Handler penting:

| File | Priority | Fungsi |
| --- | --- | --- |
| `usersHandle.js` | 3 | Mode self, auto-register user, cek ban/block, blokir fitur per grup, naikkan level |
| `chat.js` | — | Statistik & fitur berbasis chat |
| `afk.js` | — | Deteksi user AFK & mention ke user AFK |
| `respon.js`, `list.js` | — | Auto-respon & keyword list per grup |
| `MODE ON/handler.js` | — | Fitur grup yang di-toggle (antilink, antibadword, dll) |
| `GAMES/*.js` | — | Menerima jawaban game yang sedang berjalan (tanpa prefix) |

## 4. Flow Plugin (`plugins/`)

- Dimuat rekursif oleh `lib/plugins.js` dengan dynamic `import()` +
  cache-buster query (`?cacheBust=<timestamp>`) supaya hot-reload berfungsi.
- Kontrak:

```js
export default {
  handle,                  // async (sock, messageInfo) => any
  Commands: ['cmd', 'alias'],
  OnlyPremium: false,      // opsional
  OnlyOwner: false,        // opsional
  limitDeduction: 1,       // opsional; potong limit user non-premium/non-owner
};
```

- `processMessage` mengiterasi **seluruh** plugin dan menjalankan **setiap**
  plugin yang cocok — bukan berhenti di yang pertama. `handle()` yang
  mengembalikan `false` menghentikan iterasi.
- Cek permission (`OnlyOwner`, `OnlyPremium`) dan pemotongan limit dilakukan di
  `autoresbot.js`, **bukan** di dalam plugin.

## 5. Flow Database

```
lib/database.js  -> satu koneksi better-sqlite3 (synchronous), WAL mode
   ├─ lib/users.js         users, owners        (+ prepared-statement cache)
   ├─ lib/group.js         groups_data
   ├─ lib/list.js          list
   ├─ lib/sewa.js          sewa
   ├─ lib/badword.js       badwords
   ├─ lib/jadibot.js       jadibot
   ├─ lib/slr.js           slr
   ├─ lib/absen.js         absen
   ├─ lib/totalchat.js     totalchat
   └─ lib/participants.js  participants
```

- Semua query memakai parameter binding (`?`) — **tidak ada** string SQL yang
  dirakit dari input user. Satu-satunya interpolasi adalah nama kolom di
  `transferBalance()`, dan nilainya berasal dari whitelist internal
  (`'limit_count'` atau `'money'`), bukan dari user.
- Karena `better-sqlite3` synchronous, banyak fungsi di-`async` tanpa perlu.
  Ini tidak berbahaya (caller memakai `await`), tapi menyesatkan.
- Transaksi hanya dipakai di `transferBalance()`.

## 6. Kasus Khusus: Command `tebak`

10 plugin di `plugins/GAMES/` mendaftarkan command yang sama, `"tebak"`:

```
tebak angka.js  tebak bendera.js  tebak bom.js     tebak gambar.js
tebak hewan.js  tebak kalimat.js  tebak kata.js    tebak lagu.js
tebak lirik.js  tebakpemainbola.js
```

Ini **disengaja**, bukan bug. Karena `processMessage` menjalankan semua plugin
yang cocok, setiap plugin menyaring dirinya sendiri di baris pertama `handle()`:

```js
if (!fullText.includes('angka')) return true;   // lewati plugin ini
```

Sehingga `.tebak angka easy` hanya dieksekusi oleh `tebak angka.js`. Pola ini
**jangan diubah** tanpa mendesain ulang seluruh keluarga game.

## 7. Flow Response

Ada empat cara mengirim balasan, semuanya dipakai secara bercampur:

1. `sock.sendMessage(remoteJid, { text }, { quoted: message })` — paling umum.
2. `reply(m, text)` dari `lib/utils.js` — butuh `messageInfo.m`.
3. `sendTextWithMentions()` / `sendImageWithMentions()` — helper mention baru
   yang akurat (menerima daftar JID lengkap). **Ini yang direkomendasikan.**
4. `sendMessageWithMention()` / `sendMessageWithMentionNotQuoted()` /
   `sendImagesWithMention()` / `sendImagesWithMentionNotQuoted()` — helper lama
   yang menebak satu domain (`@s.whatsapp.net` atau `@lid`) untuk semua token.

## 8. Flow Error Handling

Ada **dua sistem logging paralel**:

| Sistem | File | Aktif di production? | Tujuan |
| --- | --- | --- | --- |
| Winston (`logger`, `logCustom`) | `lib/logger.js` | ❌ **tidak** (`logCustom` langsung return bila mode ≠ development) | `tmp/logs/*.log` |
| Logger file mandiri (`logError`, `logHandlerError`, `logApiError`, `logLine`) | `lib/errorLogger.js` | ✅ ya | `logs/*.log` |

Lapisan penangkapan error:

1. `serializeMessage` — `try/catch` mengembalikan `null` (**error ditelan diam-diam**).
2. `messages.upsert` listener — dua lapis try/catch, hanya `console.log`.
3. `handler.preProcess` — per handler, dicatat via `logHandlerError()`.
4. `processMessage` — try/catch luar, `logCustom` (mati di production) + `danger()`.
5. Tiap `plugin.handle()` — umumnya punya try/catch sendiri.
6. `process.on('uncaughtException' | 'unhandledRejection')` di `index.js` →
   `logError()`.

## 9. Sistem Lain

| Sistem | File |
| --- | --- |
| Cache | `lib/cache.js` — metadata grup (TTL 60 mnt), foto profil (15 mnt), `sessions: Map` |
| Session | folder `session/` (utama) dan `session/<nomor>` (jadibot), `useMultiFileAuthState` |
| Scheduler | `lib/scheduled.js` (node-schedule), `lib/autobackup.js` (interval 4 jam) |
| Downloader | `lib/utils.js` (`downloadMedia`, `downloadQuotedMedia`, `downloadToBuffer`), `lib/scrape/*` |
| Media processing | fluent-ffmpeg, jimp, canvas, wa-sticker-formatter, `lib/exif.js` |
| Permission | `isOwner()` / `isPremiumUser()` di `lib/users.js`, `checkIfAdmin()` di `lib/utils.js` |
| Anti-spam / anti-link / badword | `lib/spamDetection.js`, `lib/badwordDetection.js`, `handle/MODE ON/handler.js` |
| Payment / credit | kolom `money` & `limit_count` di tabel `users`; `transferBalance()` atomik |
| Panel Pterodactyl | `lib/panel.js` + `plugins/PANEL/*` |
