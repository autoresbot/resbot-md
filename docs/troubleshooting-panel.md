# Troubleshooting instalasi di panel (Pterodactyl dsb.)

## Gejala

```
Error dalam proses start_app: Could not locate the bindings file. Tried:
 → /home/container/node_modules/better-sqlite3/build/better_sqlite3.node
 → /home/container/node_modules/better-sqlite3/build/Release/better_sqlite3.node
 ...
```

## Apa yang sebenarnya terjadi

`better-sqlite3` bukan paket JavaScript biasa — ia **modul native**. Selain kode
JS, ia butuh satu berkas biner `better_sqlite3.node` yang **khusus untuk satu
kombinasi**: sistem operasi + arsitektur CPU + versi Node (ABI).

Berkas itu dibuat saat `npm install`, oleh script `install` miliknya:

```
prebuild-install || node-gyp rebuild --release
```

- `prebuild-install` → **mengunduh** biner siap pakai. Cepat, tidak butuh compiler.
- `node-gyp rebuild` → **mengompilasi** dari sumber. Butuh python3, make, dan g++.

Pesan "Could not locate the bindings file" artinya berkas itu tidak ada.

## Tiga penyebab paling sering

| # | Penyebab | Ciri |
|---|---|---|
| 1 | `npm install` dijalankan dengan `--ignore-scripts` | Script `install` tidak pernah jalan, jadi biner tidak pernah dibuat/diunduh |
| 2 | `node_modules` di-upload dari komputer lain | Biner Windows/x64 dibawa ke container Linux — ciri lain: `invalid ELF header` |
| 3 | Versi Node saat install ≠ versi Node saat menjalankan | Ciri lain: pesan memuat `NODE_MODULE_VERSION` |

## Bantuan dari sisi kode (sudah terpasang)

[lib/database.js](../lib/database.js) kini **memperbaiki sendiri** kondisi ini.

Saat membuka database, kalau terdeteksi masalah biner native, bot otomatis
menjalankan `npm rebuild better-sqlite3` lalu mencoba lagi:

```
[!] Binary native better-sqlite3 tidak cocok/tidak ada.
[!] Penyebab: Could not locate the bindings file. Tried:
[~] Mencoba memperbaiki otomatis: npm rebuild better-sqlite3 ...
[✔] better-sqlite3 berhasil diperbaiki otomatis.
[✔] SQLite database initialized (WAL mode)
```

Ini menyelesaikan penyebab **1 dan 3**, dan sebagian besar kasus **2** —
`npm rebuild` menjalankan `prebuild-install` lebih dulu, yang cuma mengunduh
biner yang cocok, **tanpa butuh compiler** di container.

Kalau perbaikan otomatis pun gagal, pesannya sekarang menjelaskan versi Node,
penyebab aslinya, dan langkah manualnya — bukan lagi stack trace `bindings`
yang membingungkan.

> Detail teknis: pada better-sqlite3 v12, `require()` selalu berhasil dan biner
> baru dimuat saat `new Database(...)`. Karena itu penjagaannya membungkus
> pemanggilan konstruktor, bukan require-nya.

## Yang tetap harus benar dari sisi panel

Perbaikan otomatis adalah jaring pengaman, bukan pengganti instalasi yang benar.

1. **Jangan upload `node_modules`.** Upload kodenya saja, lalu `npm install` di
   panel. Ini juga membuat upload jauh lebih ringan.
2. **Jangan pakai `--ignore-scripts`** di perintah install egg.
3. **Samakan versi Node** antara install dan runtime. Project ini butuh
   **Node >= 20** (`engines` di package.json). Kalau panel menyediakan pilihan,
   pakai Node 20 atau 22 secara konsisten.

Perintah install yang disarankan:

```bash
npm install --omit=dev --no-audit --no-fund
```

## Modul native lain di project ini

Kalau nanti muncul error serupa untuk paket lain, penyebab dan obatnya sama —
ganti nama paketnya pada perintah `npm rebuild`:

| Paket | Dipakai untuk |
|---|---|
| `better-sqlite3` | database utama (sudah ada perbaikan otomatis) |
| `canvas` | pembuatan gambar |
| `ssh2` | fitur SSH |
| `node-webpmux` | sticker WebP |

```bash
npm rebuild canvas
```
