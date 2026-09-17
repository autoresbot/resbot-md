# Resbot MD

Bot WhatsApp berbasis plugin yang ringan dan mudah dikembangkan.

```plaintext
╔═════════════════════════════════╗
║ 🛠️ Informasi Script
╠═════════════════════════════════╣
║ 📦 Version    : 5.4.1
║ 👨‍💻 Developer  : Azhari Creative
║ 🌐 Website    : autoresbot.com
║ 💻 GitHub     : github.com/autoresbot/resbot-md
╚═════════════════════════════════╝
```

> ⚠️ Script ini **open source dan gratis**, TIDAK BOLEH DIPERJUALBELIKAN.

## Fitur

Downloader, AI, sticker & maker, editor foto, game, anime, berita, islami,
tools, panel Pterodactyl, push kontak, store, textpro, dan manajemen grup —
semuanya tersusun rapi sebagai plugin di folder [plugins/](plugins/).

## Kebutuhan

- Node.js **20 ke atas**
- API key dari [autoresbot.com](https://autoresbot.com) (untuk sebagian fitur)

## Instalasi

```bash
git clone https://github.com/autoresbot/resbot-md
cd resbot-md
npm install
npm start
```

Sebelum dijalankan, atur dulu [config.js](config.js):

| Pengaturan   | Keterangan                          |
| ------------ | ----------------------------------- |
| `NOMOR_BOT`  | Nomor WhatsApp bot (contoh `628xx`) |
| `DATA_OWNER` | Nomor/LID pemilik bot               |
| `APIKEY`     | API key dari autoresbot.com         |
| `CONNECTION` | `pairing` atau `qr`                 |

## Jalan di Panel Pterodactyl

Script ini berjalan lancar di panel Pterodactyl (pakai **Docker Image Node.js 20**).
Belum punya panel? Bisa beli di:

- 🌐 [autoresbot.com](https://autoresbot.com)
- 🌐 [panelbot.id](https://panelbot.id)

## Struktur Folder

```
index.js      → entry point
config.js     → semua pengaturan bot
plugins/      → fitur bot (per kategori)
handle/       → penanganan pesan sebelum masuk plugin
lib/          → modul inti (koneksi, database, cache, utils)
database/     → penyimpanan data & aset
docs/         → dokumentasi teknis
```

## Dokumentasi

- [docs/architecture.md](docs/architecture.md) — alur kerja & struktur script
- [docs/troubleshooting-panel.md](docs/troubleshooting-panel.md) — masalah umum di panel
- [docs/snippets.md](docs/snippets.md) — contoh kode untuk membuat plugin
- [catatan.txt](catatan.txt) — catatan perubahan tiap versi

## Kontak & Update

- 📢 Saluran WhatsApp: https://www.whatsapp.com/channel/0029VaDSRuf05MUekJbazP1D
- 🌐 Website: https://autoresbot.com
- 📧 Email: autoresbot@gmail.com
