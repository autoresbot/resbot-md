import { createAndSendBackup } from '../../lib/backupService.js';
import { jelaskanErrorWa, buildErrorMessage, STAGE } from '../../lib/backupErrors.js';
import { logCustom } from '../../lib/logger.js';

/**
 * Tampilkan nomor tujuan tanpa domain JID (lebih enak dibaca).
 */
function namaTujuan(jid) {
  return String(jid).split('@')[0];
}

/**
 * Susun laporan hasil backup: siapa yang menerima, siapa yang gagal, dan kenapa.
 */
function buildReport({ backup, terkirim, gagal, invalid, dibatasi }) {
  const lines = [
    '✅ _Berhasil, data backup telah dibuat dan dikirim_',
    '',
    `Size : ${backup.size}`,
    `Time : ${backup.time}`,
    '',
    `📤 *Terkirim (${terkirim.length}) :*`,
    ...terkirim.map((jid) => `• ${namaTujuan(jid)}`),
  ];

  if (gagal.length) {
    lines.push('', `⚠️ *Gagal terkirim (${gagal.length}) :*`);
    for (const item of gagal) {
      lines.push(`• ${namaTujuan(item.jid)} — ${item.sebab}`);
      if (item.solusi) lines.push(`  🛠️ ${item.solusi}`);
    }
  }

  if (invalid.length) {
    lines.push('', `🚫 *Dilewati (nomor tidak valid) :*`, ...invalid.map((t) => `• ${t}`));
  }

  if (dibatasi) {
    lines.push('', 'ℹ️ Jumlah tujuan dibatasi demi keamanan akun (anti-banned).');
  }

  return lines.join('\n');
}

async function handle(sock, messageInfo) {
  const { remoteJid, message } = messageInfo;

  try {
    await sock.sendMessage(remoteJid, {
      react: { text: '⏰', key: message.key },
    });

    // Sumber logika backup tunggal: buat file + kirim ke nomor bot & owner
    const hasil = await createAndSendBackup(sock, { type: 'Manual' });

    await sock.sendMessage(remoteJid, { text: buildReport(hasil) }, { quoted: message });
  } catch (err) {
    const info = jelaskanErrorWa(err, STAGE.BACKUP);

    console.error(`[BACKUP] Gagal pada tahap "${info.stage}":`, err);
    logCustom(
      'error',
      `[${info.stage}] ${info.sebab} | ${info.teknis || '-'}\n${err?.stack || ''}`,
      'ERROR-COMMAND-backup.txt',
    );

    await sock.sendMessage(remoteJid, { text: buildErrorMessage(info) }, { quoted: message });
  }
}

export default {
  handle,
  Commands: ['backup'],
  OnlyPremium: false,
  OnlyOwner: true,
};
