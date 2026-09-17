# Contoh Kode untuk Developer

Kumpulan potongan kode yang sering dipakai saat membuat plugin Resbot MD.

## API autoresbot.com

Package: `api-autoresbot` (sudah termasuk di `package.json`).

```javascript
// Request biasa
const response = await api.get('/api/random/zikir');

// Request dengan parameter
const response = await api.get('/api/gemini', { text: content });

// Request dengan response buffer
const response = await api.getBuffer('/api/maker/attp2', { text: content });

// Upload media sementara
const response = await api.tmpUpload(mediaPath);
```

## Mengirim Pesan

```javascript
// Teks
await sock.sendMessage(remoteJid, { text: 'Example' });
await sock.sendMessage(remoteJid, { text: 'Example' }, { quoted: message });

// Gambar dari URL atau buffer
await sock.sendMessage(remoteJid, {
  image: { url: 'https://example.com/tes.jpg' },
  caption: `Caption`,
});
await sock.sendMessage(remoteJid, { image: buffer, caption: `Caption` }, { quoted: message });

// Audio dari URL atau buffer
await sock.sendMessage(
  remoteJid,
  { audio: { url: '' }, mimetype: 'audio/mp4' },
  { quoted: message },
);
await sock.sendMessage(remoteJid, { audio: bufferAudio }, { quoted: message });

// Reaction
await sock.sendMessage(remoteJid, { react: { text: '⏰', key: message.key } });
```

## Pesan Terusan (Forwarded)

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
  { quoted: message },
);
```

## Cache Metadata Grup

```javascript
import { getGroupMetadata, getProfilePictureUrl, groupFetchAllParticipating } from './cache.js';

getGroupMetadata(sock, remoteJid);
```

## Return Value di Folder `handle/`

```javascript
return false; // Menghentikan proses handler tanpa lanjut ke plugin
return true;  // Menghentikan proses handler dan lanjut ke plugin
return;       // Lanjut ke handler lain dan plugin
```
