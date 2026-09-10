import { createAndSendBackup } from '../../lib/backupService.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message } = messageInfo;

  try {
    await sock.sendMessage(remoteJid, {
      react: { text: '⏰', key: message.key },
    });

    // Sumber logika backup tunggal: buat file + kirim ke nomor bot & owner
    const backupFilePath = await createAndSendBackup(sock, { type: 'Manual' });

    await sock.sendMessage(
      remoteJid,
      {
        text: `✅ _Berhasil, data backup telah disimpan dan terkirim ke nomor bot & owner_

Size : ${backupFilePath.size}
Time : ${backupFilePath.time}
`,
      },
      { quoted: message },
    );
  } catch (err) {
    console.error('Backup failed:', err);

    await sock.sendMessage(
      remoteJid,
      {
        text: `❌ _Gagal melakukan backup:_ ${err.message}`,
      },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['backup'],
  OnlyPremium: false,
  OnlyOwner: true,
};
