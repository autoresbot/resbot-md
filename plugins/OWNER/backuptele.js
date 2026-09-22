/**
 * .backuptele - Kirim file backup project ke Telegram.
 *
 * Konfigurasi ada di config.js:
 *   TELEGRAM: { token: '...', chat_id: '...' }
 *
 * Seluruh logikanya berada di lib/telegramBackup.js supaya bisa dipakai juga
 * oleh AUTO_BACKUP. Plugin ini hanya mengurus pesan ke WhatsApp.
 */

import {
  createAndSendTelegramBackup,
  isTelegramConfigured,
  jelaskanErrorTelegram,
  panduanSetup,
} from '../../lib/telegramBackup.js';
import { STAGE, buildErrorMessage } from '../../lib/backupErrors.js';
import { logCustom } from '../../lib/logger.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message } = messageInfo;

  // Belum dikonfigurasi -> kirim panduan, jangan lanjut
  if (!isTelegramConfigured()) {
    return await sock.sendMessage(remoteJid, { text: panduanSetup() }, { quoted: message });
  }

  // Dipakai supaya pesan error tahu proses mana yang sedang berjalan
  let stage = STAGE.CONFIG;

  try {
    await sock.sendMessage(remoteJid, {
      react: { text: '⏰', key: message.key },
    });

    stage = STAGE.UPLOAD;
    const { backup, chat } = await createAndSendTelegramBackup({ type: 'Manual' });

    const tujuan = chat?.title || chat?.username || chat?.first_name || 'chat Telegram';

    return await sock.sendMessage(
      remoteJid,
      {
        text: `✅ _Berhasil, data backup telah terkirim ke Telegram_

Tujuan : ${tujuan}
Size : ${backup.size}
Time : ${backup.time}
`,
      },
      { quoted: message },
    );
  } catch (err) {
    const info = jelaskanErrorTelegram(err, stage);

    console.error(`[BACKUPTELE] Gagal pada tahap "${info.stage}":`, err);
    logCustom(
      'error',
      `[${info.stage}] ${info.sebab} | ${info.teknis || '-'}\n${err?.stack || ''}`,
      'ERROR-COMMAND-backuptele.txt',
    );

    return await sock.sendMessage(
      remoteJid,
      { text: buildErrorMessage(info, '❌ *Backup ke Telegram GAGAL*') },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['backuptele'],
  OnlyPremium: false,
  OnlyOwner: true,
};
