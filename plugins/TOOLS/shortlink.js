import axios from 'axios';

/**
 * Perpendek URL memakai layanan GRATIS tanpa apikey.
 * Dicoba berurutan: is.gd -> v.gd -> tinyurl. Kalau satu gagal, pakai berikutnya.
 */
async function shorten(url) {
  const penyedia = [
    {
      nama: 'is.gd',
      req: () =>
        axios.get('https://is.gd/create.php', {
          params: { format: 'simple', url },
          timeout: 15000,
        }),
    },
    {
      nama: 'v.gd',
      req: () =>
        axios.get('https://v.gd/create.php', {
          params: { format: 'simple', url },
          timeout: 15000,
        }),
    },
    {
      nama: 'tinyurl',
      req: () =>
        axios.get('https://tinyurl.com/api-create.php', {
          params: { url },
          timeout: 15000,
        }),
    },
  ];

  let lastErr = 'tidak diketahui';
  for (const p of penyedia) {
    try {
      const res = await p.req();
      const hasil = String(res.data || '').trim();
      // is.gd/v.gd membalas "Error: ..." dengan status 200 bila gagal.
      if (/^https?:\/\//i.test(hasil)) {
        return { ok: true, short: hasil, via: p.nama };
      }
      lastErr = hasil || `respon kosong dari ${p.nama}`;
    } catch (e) {
      lastErr = e?.message || String(e);
    }
  }
  return { ok: false, alasan: lastErr };
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command, isQuoted } = messageInfo;

  // Ambil URL dari teks perintah atau dari pesan yang di-reply.
  const input = (content && content.trim()) || isQuoted?.text?.trim() || '';

  if (!input) {
    return sock.sendMessage(
      remoteJid,
      {
        text: `_⚠️ Format Penggunaan:_\n\n_💬 Contoh:_ *${prefix + command} https://autoresbot.com/halaman-panjang*`,
      },
      { quoted: message },
    );
  }

  // Ambil URL pertama dari input.
  const urlMatch = input.match(/https?:\/\/[^\s]+/i);
  if (!urlMatch) {
    return sock.sendMessage(
      remoteJid,
      { text: `⚠️ _URL tidak valid. Pastikan diawali http:// atau https://_` },
      { quoted: message },
    );
  }
  const url = urlMatch[0];

  await sock.sendMessage(remoteJid, { react: { text: '⏰', key: message.key } });

  const hasil = await shorten(url);

  if (!hasil.ok) {
    return sock.sendMessage(
      remoteJid,
      { text: `⚠️ _Gagal memperpendek URL._\n\n_Alasan: ${hasil.alasan}_` },
      { quoted: message },
    );
  }

  return sock.sendMessage(
    remoteJid,
    {
      text: `✅ *Shortlink berhasil dibuat*\n\n🔗 ${hasil.short}\n\n_via ${hasil.via}_`,
    },
    { quoted: message },
  );
}

export default {
  handle,
  Commands: ['shortlink', 'slink'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
