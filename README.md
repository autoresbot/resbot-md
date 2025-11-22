# 🛠️ Informasi Script

```plaintext
╔═════════════════════════════════╗
║ 🛠️ Informasi Script
╠═════════════════════════════════╣
║ 📦 Version    : 5.0.1
║ 👨‍💻 Developer  : Azhari Creative
║ 🌐 Website    : autoresbot.com
║ 💻 GitHub     : github.com/autoresbot/resbot-md
╚═════════════════════════════════╝
```

```javascript
⚠️ Peringatan:
SCRIPT INI TIDAK BOLEH DIPERJUALBELIKAN.
[👉 autoresbot.com](https://autoresbot.com)
```

# API USE from api.autoresbot.com

Dokumentasi penggunaan API dari **api.autoresbot.com** untuk integrasi ke dalam proyek Anda.

## Instalasi

Pastikan Anda sudah menginstal package `api-autoresbot` melalui npm:

```bash
npm install api-autoresbot
```

## Menggunakan API

```javascript
const response = await api.get("/api/random/zikir");
```

## Menggunakan API dengan Parameter

```javascript
const response = await api.get("/api/gemini", { text: content });
```

## Menggunakan API dengan response buffer

```javascript
const response = await api.getBuffer("/api/maker/attp2", { text: content });
```

## Menggunakan API untuk upload media sementara

```javascript
const response = await api.tmpUpload(mediaPath);
```

# =======================

## Mengirim pesan teks

```javascript
await sock.sendMessage(remoteJid, { text: "Example" });
await sock.sendMessage(remoteJid, { text: "Example" }, { quoted: message });
```

## Mengirim gambar dari URL dan buffer

```javascript
await sock.sendMessage(remoteJid, {
  image: { url: "https://example.com/tes.jpg" },
  caption: `Caption`,
});
await sock.sendMessage(
  remoteJid,
  { image: { url: "https://example.com/tes.jpg" }, caption: `Caption` },
  { quoted: message }
);

await sock.sendMessage(remoteJid, { image: buffer, caption: `Caption` });
await sock.sendMessage(
  remoteJid,
  { image: buffer, caption: `Caption` },
  { quoted: message }
);
```

## Mengirim audio dari URL dan buffer

```javascript
await sock.sendMessage(
  remoteJid,
  { audio: { url: "" }, mimetype: "audio/mp4" },
  { quoted: message }
);
await sock.sendMessage(remoteJid, { audio: bufferAudio }, { quoted: message });
```

## Menambahkan reaction pada pesan

```javascript
await sock.sendMessage(remoteJid, { react: { text: "⏰", key: message.key } });
```

## Mengirim pesan terusan

```javascript
sock.sendMessage(
  remoteJid,
  {
    text: `Ini adalah contoh pesan terusan`,
    contextInfo: {
      forwardingScore: 7,
      isForwarded: true,
      mentionedJid: [remoteJid],
    },
  },
  { quoted: message }
);
```

## Menggunakan cache untuk metadata grup

```javascript
import {
  getGroupMetadata,
  getProfilePictureUrl,
  groupFetchAllParticipating,
} from "./cache.js";

getGroupMetadata(sock, remoteJid);
```

## Handler untuk proses handle (folder handle)

```javascript
return false; // Menghentikan proses handler tanpa lanjut ke plugin
return true; // Menghentikan proses handler dan lanjut ke plugin
return; // Lanjut ke handler lain dan plugin
```
