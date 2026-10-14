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
  BOT_CEK_ID,
  createAndSendTelegramBackup,
  cariChatId,
  getTelegramConfig,
  isTelegramConfigured,
  isTokenValid,
  jelaskanErrorTelegram,
  panduanSetup,
} from '../../lib/telegramBackup.js';
import { STAGE, buildErrorMessage } from '../../lib/backupErrors.js';
import { logCustom } from '../../lib/logger.js';

// Lama bot menunggu pesan baru di Telegram saat mencari Chat ID
const TUNGGU_DETIK = 45;

const LABEL_JENIS = {
  private: 'Chat pribadi',
  group: 'Grup',
  supergroup: 'Grup',
  channel: 'Channel',
};

/**
 * `.backuptele id [token]` - tampilkan Chat ID Telegram langsung di WhatsApp,
 * supaya user tidak perlu membuka getUpdates di browser.
 */
async function kirimChatId(sock, messageInfo, tokenArg) {
  const { remoteJid, message, prefix, command } = messageInfo;
  const perintah = `${prefix}${command}`;
  const balas = (text) => sock.sendMessage(remoteJid, { text }, { quoted: message });

  const token = String(tokenArg || getTelegramConfig().token || '').trim();

  if (!token) {
    return await balas(
      `⚠️ Token bot Telegram belum ada.\n\nKetik: *${perintah} id TOKEN_KAMU*\n\n_Token didapat dari @BotFather di Telegram (ketik /newbot)._`,
    );
  }

  if (!isTokenValid(token)) {
    return await balas(
      `⚠️ Format token tidak valid.\n\nToken berbentuk \`angka:huruf-acak\`, contoh:\n\`123456789:AAE-xxxxxxxxxxxxxxxxxxxxxxxxxx\`\n\nSalin ulang dari @BotFather.`,
    );
  }

  try {
    await sock.sendMessage(remoteJid, { react: { text: '⏰', key: message.key } });

    let { bot, chats } = await cariChatId(token);
    const namaBot = bot?.username ? `@${bot.username}` : 'bot kamu';

    // Belum ada pesan yang tercatat. Ini normal walau bot SUDAH ada di grup:
    // bot Telegram tidak menerima obrolan biasa di grup (privacy mode), hanya
    // perintah yang ditujukan kepadanya, dan catatan "bot ditambahkan" hilang
    // setelah ±24 jam. Jadi user diminta mengirim perintah sekarang, dan bot
    // menunggunya sebentar.
    if (chats.length === 0) {
      const perintahGrup = bot?.username ? `/start@${bot.username}` : '/start';
      await balas(
        `⏳ *Menunggu pesan di Telegram (${TUNGGU_DETIK} detik)...*\n\nSekarang buka Telegram lalu:\n• *Untuk grup:* ketik di grupnya\n  \`${perintahGrup}\`\n  _(pesan biasa tidak terbaca oleh bot, harus perintah ini)_\n• *Untuk chat pribadi:* buka ${namaBot} lalu klik *Start*\n\nChat ID akan muncul di sini begitu pesannya masuk.`,
      );

      ({ chats } = await cariChatId(token, { tungguDetik: TUNGGU_DETIK }));

      if (chats.length === 0) {
        return await balas(
          `ℹ️ Belum ada pesan yang masuk ke ${namaBot}.\n\nKetik lagi *${perintah} id*${tokenArg ? ' TOKEN_KAMU' : ''}, lalu dalam ${TUNGGU_DETIK} detik kirim \`${perintahGrup}\` di grup Telegram (atau klik Start di chat pribadi bot).\n\n_Hanya butuh ID akunmu sendiri? Buka ${BOT_CEK_ID} di Telegram lalu klik Start._`,
        );
      }
    }

    const daftar = chats
      .map((c) => `• *${c.nama}* (${LABEL_JENIS[c.type] || c.type})\n  Chat ID: \`${c.id}\``)
      .join('\n\n');

    const lines = [`✅ *Chat ID Telegram* — ${namaBot}`, '', daftar, ''];
    if (chats.length > 1) lines.push('Pilih salah satu sebagai tujuan backup.');
    lines.push(
      'Isi di *config.js* lalu restart bot:',
      '```',
      ...(tokenArg ? [`const TELEGRAM_BOT_TOKEN = 'token_kamu';`] : []),
      `const TELEGRAM_CHAT_ID = '${chats[0].id}';`,
      '```',
    );
    if (tokenArg) {
      lines.push('', '_Token bersifat rahasia. Hapus pesan yang berisi token setelah selesai._');
    }

    return await balas(lines.join('\n'));
  } catch (err) {
    const info = jelaskanErrorTelegram(err, STAGE.CONFIG);
    console.error(`[BACKUPTELE] Gagal mencari chat id: ${info.sebab}`);
    return await balas(buildErrorMessage(info, '❌ *Gagal mengambil Chat ID Telegram*'));
  }
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, prefix, command, content } = messageInfo;

  const [sub, tokenArg] = String(content || '').trim().split(/\s+/);
  if (['id', 'cekid', 'chatid'].includes((sub || '').toLowerCase())) {
    return await kirimChatId(sock, messageInfo, tokenArg);
  }

  // Belum dikonfigurasi -> kirim panduan, jangan lanjut
  if (!isTelegramConfigured()) {
    return await sock.sendMessage(
      remoteJid,
      { text: panduanSetup(`${prefix}${command}`) },
      { quoted: message },
    );
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
