import { runMigration } from '../../lib/migrate.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;

  const confirm = content?.trim().toLowerCase();

  // Konfirmasi wajib
  if (!confirm.endsWith('-y')) {
    return await sock.sendMessage(
      remoteJid,
      {
        text:
          `⚠️ *Peringatan*\n` +
          `Perintah ini akan memindahkan database JSON ke SQLite.\n` +
          `Disarankan hanya dijalankan *1x saja*.\n\n` +
          `Ketik *${prefix + command} -y* untuk lanjut.`,
      },
      { quoted: message },
    );
  }

  try {
    // React loading
    await sock.sendMessage(remoteJid, {
      react: { text: '⏳', key: message.key },
    });

    // Jalankan migrasi
    await runMigration();

    // Success
    await sock.sendMessage(
      remoteJid,
      {
        text: `✅ *Migrasi berhasil!*\n\n` + `Silakan restart server agar perubahan diterapkan.`,
      },
      { quoted: message },
    );
  } catch (err) {
    console.error('Migration error:', err);

    // Error message jelas
    await sock.sendMessage(
      remoteJid,
      {
        text: `❌ *Migrasi gagal!*\n` + `Error: ${err?.message || err}`,
      },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['migrasi'],
  OnlyPremium: false,
  OnlyOwner: true,
};
