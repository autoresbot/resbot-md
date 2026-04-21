import { downloadQuotedMedia, downloadMedia, reply, style } from '../../lib/utils.js';
import config from '../../config.js';
import fs from 'fs';
import path from 'path';
import { Jimp } from 'jimp';
import jsQR from 'jsqr';

export async function handle(sock, messageInfo) {
  const { m, remoteJid, message, prefix, command, isQuoted, type } = messageInfo;

  try {
    await sock.sendMessage(remoteJid, {
      react: { text: '⏰', key: message.key },
    });

    const mediaType = isQuoted ? isQuoted.type : type;
    if (mediaType !== 'image') {
      return await reply(m, `⚠️ _Kirim/Balas gambar dengan caption *${prefix + command}*_`);
    }

    const media = isQuoted ? await downloadQuotedMedia(message) : await downloadMedia(message);

    const mediaPath = path.join('tmp', media);

    if (!fs.existsSync(mediaPath)) {
      throw new Error('File media tidak ditemukan setelah diunduh.');
    }

    const img = await Jimp.read(mediaPath);

    // Convert ke format jsQR
    const { data, width, height } = img.bitmap;
    const clampedArray = new Uint8ClampedArray(data);

    const qrCode = jsQR(clampedArray, width, height);

    if (!qrCode) {
      throw new Error('❌ QR Code tidak terdeteksi dalam gambar.');
    }

    const qrResult = qrCode.data;

    await sock.sendMessage(
      remoteJid,
      {
        text: `✧  *Q R - C O D E - D E T E C T E D*\n\n` + `${qrResult}`,
        footer: config.footer,
        interactiveButtons: [
          {
            name: 'cta_copy',
            buttonParamsJson: JSON.stringify({
              display_text: style('Copy'),
              copy_code: qrResult,
            }),
          },
        ],
      },
      { quoted: message },
    );

    // hapus file
    fs.unlinkSync(mediaPath);
  } catch (error) {
    console.error('Kesalahan dalam fungsi handle:', error);

    const errorMessage = error.message || 'Terjadi kesalahan tak dikenal.';
    return await sock.sendMessage(
      remoteJid,
      { text: `_Error: ${errorMessage}_` },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['detectqr', 'readqr'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
