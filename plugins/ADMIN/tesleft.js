import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { getGroupMetadata, getProfilePictureUrl } from '../../lib/cache.js';
import { checkMessage, getLeftMedia } from '../../lib/participants.js';

/**
 * Pratinjau pesan perpisahan (.setleft) tanpa harus menunggu ada yang keluar.
 * Yang ditampilkan adalah setelan grup ini apa adanya.
 */
async function handle(sock, messageInfo) {
  const { remoteJid, sender, message, pushName, isGroup, prefix } = messageInfo;
  if (!isGroup) return; // Only Grub

  try {
    const mode = String((await checkMessage(remoteJid, 'templateleft')) || 'text');
    const teks = (await checkMessage(remoteJid, 'remove')) || 'Selamat tinggal @name';

    if (mode === 'text') {
      await sock.sendMessage(remoteJid, { text: teks }, { quoted: message });
      return;
    }

    await sock.sendMessage(remoteJid, { react: { text: '⏰', key: message.key } });

    // Foto/video milik grup sendiri
    if (mode === 'media') {
      const media = getLeftMedia(remoteJid);
      const filePath = media ? path.join(process.cwd(), 'database', 'media', media.file) : null;

      if (!filePath || !fs.existsSync(filePath)) {
        await sock.sendMessage(
          remoteJid,
          { text: `⚠️ _File perpisahan tidak ditemukan. Atur ulang dengan *${prefix}setleft foto/video*_` },
          { quoted: message },
        );
        return;
      }

      const buffer = fs.readFileSync(filePath);
      await sock.sendMessage(
        remoteJid,
        media.tipe === 'video'
          ? { video: buffer, caption: teks, gifPlayback: media.gif === true }
          : { image: buffer, caption: teks },
        { quoted: message },
      );
      return;
    }

    // Gambar goodbye dari API
    const ppUser = await getProfilePictureUrl(sock, sender);
    const groupMetadata = await getGroupMetadata(sock, remoteJid);

    const response = await axios.post(
      'https://api.autoresbot.com/api/maker/goodbye',
      {
        pp: ppUser,
        name: pushName,
        gcname: groupMetadata?.subject,
        member: groupMetadata?.size,
      },
      { responseType: 'arraybuffer' },
    );

    await sock.sendMessage(
      remoteJid,
      { image: Buffer.from(response.data), caption: teks },
      { quoted: message },
    );
  } catch (error) {
    console.error('Error handling tesleft:', error?.message || error);
    await sock.sendMessage(
      remoteJid,
      { text: '⚠️ _Terjadi kesalahan saat membuat pratinjau perpisahan._' },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['tesleft'],
  OnlyPremium: false,
  OnlyOwner: false,
};
