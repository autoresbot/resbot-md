// ════════════════════════════════════════════════════════════════════
// 🔧 KONFIGURASI TELEGRAM  (isi di sini, atau lewat config.js — lihat bawah)
// ════════════════════════════════════════════════════════════════════
//
// Cara mengisi:
//   1. TELEGRAM_BOT_TOKEN : token bot dari @BotFather (langkah di bawah).
//   2. TELEGRAM_CHAT_ID    : ID tujuan (chat pribadi / grup / channel).
//
// Contoh:
//   const TELEGRAM_BOT_TOKEN = '123456789:AAE-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
//   const TELEGRAM_CHAT_ID   = '123456789';
//
const TELEGRAM_BOT_TOKEN = '8822823396:AAGwsrmOWZp9npz5tVkf591Y2JxrwioboSc';
const TELEGRAM_CHAT_ID = '6398972009';
// ════════════════════════════════════════════════════════════════════

import FormData from 'form-data';
import fs from 'fs';
import axios from 'axios';
import moment from 'moment-timezone';
import config from '../../config.js';
import { createBackup } from '../../lib/utils.js';

const BACKUP_FILENAME = 'autoresbot-backup.zip';

/**
 * Ambil token & chat id. Prioritas: konstanta di atas file,
 * lalu fallback ke config.js (config.TELEGRAM = { token, chat_id }).
 */
function getTelegramConfig() {
  const token = (TELEGRAM_BOT_TOKEN || config.TELEGRAM?.token || '').trim();
  const chatId = String(TELEGRAM_CHAT_ID || config.TELEGRAM?.chat_id || '').trim();
  return { token, chatId };
}

/**
 * Pesan panduan bila token / chat id belum diisi.
 */
function panduanSetup() {
  return `⚠️ *Backup Telegram belum dikonfigurasi*

Token bot / chat id belum diisi. Ikuti langkah berikut:

*A. Membuat Bot & Token (BotFather)*
1. Buka Telegram, cari akun *@BotFather*
2. Ketik /newbot lalu ikuti instruksinya (beri nama & username bot)
3. BotFather akan memberi *token*, contoh:
   \`123456789:AAE-xxxxxxxxxxxxxxxxxxxxxxxxxx\`

*B. Mendapatkan Chat ID*
1. Kirim satu pesan apa saja ke bot yang baru kamu buat
2. Buka di browser (ganti <TOKEN> dengan token kamu):
   https://api.telegram.org/bot<TOKEN>/getUpdates
3. Cari bagian \`"chat":{"id":...}\` — angka itulah *chat id* kamu
   (untuk grup, tambahkan botnya ke grup lalu kirim pesan; id grup diawali tanda minus)
   Alternatif: chat ke *@userinfobot* untuk melihat id akunmu.

*C. Menyimpan Konfigurasi*
Isi di bagian atas file \`plugins/OWNER/backuptele.js\`:
\`\`\`
const TELEGRAM_BOT_TOKEN = 'token_kamu';
const TELEGRAM_CHAT_ID   = 'chat_id_kamu';
\`\`\`
Atau lewat *config.js*:
\`\`\`
TELEGRAM: { token: 'token_kamu', chat_id: 'chat_id_kamu' }
\`\`\`

Setelah diisi, jalankan kembali perintah *.backuptele*`;
}

/**
 * Susun caption dokumen backup.
 */
function buildCaption(backup) {
  const tanggal = moment.tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm:ss');
  const lines = ['🗄️ *Backup Data (Telegram)*', `📅 Tanggal : ${tanggal}`];
  if (backup?.size) lines.push(`📦 Ukuran : ${backup.size}`);
  lines.push('🏷️ Jenis : Manual');
  return lines.join('\n');
}

/**
 * Kirim file backup ke Telegram via API sendDocument (streaming, hemat memori).
 */
async function sendToTelegram(token, chatId, filePath, caption) {
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', caption);
  form.append('parse_mode', 'Markdown');
  form.append('document', fs.createReadStream(filePath), { filename: BACKUP_FILENAME });

  const { data } = await axios.post(
    `https://api.telegram.org/bot${token}/sendDocument`,
    form,
    {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 120000,
    },
  );

  if (!data?.ok) {
    throw new Error(data?.description || 'Respons Telegram tidak valid');
  }
  return data;
}

async function handle(sock, messageInfo) {
  const { remoteJid, message } = messageInfo;

  const { token, chatId } = getTelegramConfig();

  // Belum dikonfigurasi -> kirim panduan, jangan lanjut
  if (!token || !chatId) {
    await sock.sendMessage(remoteJid, { text: panduanSetup() }, { quoted: message });
    return;
  }

  try {
    await sock.sendMessage(remoteJid, {
      react: { text: '⏰', key: message.key },
    });

    // Buat file backup (path, size, time)
    const backup = await createBackup();

    // Kirim ke Telegram
    await sendToTelegram(token, chatId, backup.path, buildCaption(backup));

    await sock.sendMessage(
      remoteJid,
      {
        text: `✅ _Berhasil, data backup telah terkirim ke Telegram_

Size : ${backup.size}
Time : ${backup.time}
`,
      },
      { quoted: message },
    );
  } catch (err) {
    console.error('Backup Telegram failed:', err);

    // Pesan error Telegram lebih jelas bila tersedia
    const detail = err?.response?.data?.description || err.message;

    await sock.sendMessage(
      remoteJid,
      { text: `❌ _Gagal backup ke Telegram:_ ${detail}` },
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
