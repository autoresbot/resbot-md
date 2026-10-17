import mess from '../../strings.js';
import { logCustom } from '../../lib/logger.js';
import { ambilGambarMaker } from '../../lib/maker.js';

// Template yang tersedia di API: 1-8 (atau 'random').
const TEMPLATE_MAX = 8;

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, isQuoted, prefix, command } = messageInfo;

  try {
    const input = content && content.trim() !== '' ? content.trim() : (isQuoted?.text ?? '').trim();

    // Format: nama  ATAU  nama|template. Nama wajib diisi.
    const bagian = input.split('|').map((s) => s.trim());
    const nama = bagian[0] || '';
    const templateRaw = bagian[1] || '';
    const template = templateRaw ? Number(templateRaw) : 'random';

    const templateValid =
      template === 'random' ||
      (Number.isInteger(template) && template >= 1 && template <= TEMPLATE_MAX);

    if (!nama || !templateValid) {
      await sock.sendMessage(
        remoteJid,
        {
          text:
            (nama ? `_⚠️ Template harus 1-${TEMPLATE_MAX}._\n\n` : `_⚠️ Nama tidak boleh kosong._\n\n`) +
            `_Format:_ *${prefix + command} nama | 1-${TEMPLATE_MAX}*` +
            `\n\n_💬 Contoh:_\n_*${prefix + command} resbot | 3*_` +
            `\n_*${prefix + command} resbot*_ _(template acak)_`,
        },
        { quoted: message },
      );
      return;
    }

    await sock.sendMessage(remoteJid, { react: { text: '⏰', key: message.key } });

    const buffer = await ambilGambarMaker('/api/maker/fakeff', { name: nama, template });

    await sock.sendMessage(
      remoteJid,
      { image: buffer, caption: mess.general.success },
      { quoted: message },
    );
  } catch (error) {
    console.error('Kesalahan di fungsi handle:', error);
    logCustom('info', content, `ERROR-COMMAND-${command}.txt`);

    await sock.sendMessage(
      remoteJid,
      { text: `_Error: ${error.message || 'Terjadi kesalahan tak dikenal.'}_` },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['fakeff'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
