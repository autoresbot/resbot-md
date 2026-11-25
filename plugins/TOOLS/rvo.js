import { downloadQuotedMedia, reply } from '../../lib/utils.js';
import { getGroupMetadata } from '../../lib/cache.js';

import fs from 'fs';
import path from 'path';
import mess from '../../strings.js';

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, sender, prefix, command, type, isQuoted } = messageInfo;

  try {
    // Mendapatkan metadata grup
    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    const participants = groupMetadata.participants;
    const isAdmin = participants.some(
      (p) => (p.phoneNumber === sender || p.id === sender) && p.admin,
    );
    if (!isAdmin) {
      await sock.sendMessage(remoteJid, { text: mess.general.isAdmin }, { quoted: message });
      return;
    }

    const mediaType = isQuoted ? isQuoted.type : type;
    if (mediaType !== 'viewonce' || !isQuoted) {
      return await reply(m, `⚠️ _Balas media sekali lihat dengan caption *${prefix + command}*_`);
    }

    // Tampilkan reaksi "Loading"
    await sock.sendMessage(remoteJid, {
      react: { text: '⏰', key: message.key },
    });

    // Download
    const media = await downloadQuotedMedia(message);
    if (!media) {
      // WhatsApp tidak mengirim media sekali lihat ke perangkat tertaut
      // (bot = linked device): yang diterima hanya penanda
      // <unavailable type="view_once"/>, dan quote-nya pun tanpa mediaKey.
      return await reply(
        m,
        '⚠️ *Media sekali lihat tidak bisa diambil*\n\n' +
          'Bot terhubung ke WhatsApp sebagai *perangkat tertaut* (seperti WhatsApp Web). ' +
          'Sejak kebijakan privasi terbaru, WhatsApp *tidak mengirimkan isi media sekali lihat* ' +
          'ke perangkat tertaut — bot hanya menerima penanda kosong tanpa gambar/video/suaranya.\n\n' +
          '• Ini *bukan* karena batas waktu, media lama, atau bot sedang offline.\n' +
          '• Ini *bukan* error bot — berlaku untuk semua bot WhatsApp.\n' +
          '• Media sekali lihat hanya bisa dibuka langsung di *HP penerima*.\n\n' +
          '_Fitur ini tetap bisa dipakai bila suatu saat WhatsApp kembali mengirimkan medianya._',
      );
    }
    const mediaPath = path.join('tmp', media);

    if (!fs.existsSync(mediaPath)) {
      throw new Error('File media tidak ditemukan setelah diunduh.');
    }

    // Membaca file menjadi Buffer
    const mediaBuffer = fs.readFileSync(mediaPath);

    const ext = path.extname(media).toLowerCase();

    if (ext === '.mp3' || ext === '.ogg') {
      await sock.sendMessage(
        remoteJid,
        {
          audio: mediaBuffer,
          mimetype: 'audio/mp4',
          ptt: true,
        },
        { quoted: message },
      );
      return;
    }

    if (ext === '.jpg') {
      await sock.sendMessage(
        remoteJid,
        {
          image: mediaBuffer,
          caption: mess.general.success,
        },
        { quoted: message },
      );
      return;
    }

    if (ext === '.mp4') {
      await sock.sendMessage(
        remoteJid,
        { video: mediaBuffer, caption: mess.general.success },
        { quoted: message },
      );
      return;
    }
  } catch (error) {
    console.error('Kesalahan saat memproses perintah Rvo:', error);

    // Kirim pesan kesalahan yang lebih informatif
    const errorMessage = `_Terjadi kesalahan saat memproses gambar._`;
    await reply(m, errorMessage);
  }
}

export default {
  handle,
  Commands: ['rvo'],
  OnlyPremium: false,
  OnlyOwner: false,
};
