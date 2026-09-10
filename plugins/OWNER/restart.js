import fs from 'fs';
import { exec } from 'child_process';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const RESTARTING_FILE = 'restaring.txt';

function saveRestartGroupId(groupId) {
  try {
    const previousIds = fs.existsSync(RESTARTING_FILE)
      ? fs
          .readFileSync(RESTARTING_FILE, 'utf-8')
          .split(/\r?\n/)
          .map((id) => id.trim())
          .filter(Boolean)
      : [];

    if (!previousIds.includes(groupId)) {
      previousIds.push(groupId);
    }

    fs.writeFileSync(RESTARTING_FILE, previousIds.join('\n'));
  } catch (error) {
    console.error('Gagal menyimpan ID grup restart:', error);
  }
}

async function handle(sock, messageInfo) {
  const { remoteJid, message } = messageInfo;

  try {
    // Kirim pesan reaksi sebagai tanda proses dimulai
    await sock.sendMessage(remoteJid, {
      react: { text: '⏰', key: message.key },
    });

    if (remoteJid.endsWith('@g.us')) {
      saveRestartGroupId(remoteJid);
    }

    await sock.sendMessage(
      remoteJid,
      {
        text: '♻️ _Bot sedang restart... notifikasi akan dikirim setelah bot online kembali._',
      },
      { quoted: message },
    );

    await sleep(2000);

    exec(`node index`);
  } catch (error) {
    console.error('Terjadi kesalahan:', error);
  }
}

export default {
  handle,
  Commands: ['restart'],
  OnlyPremium: false,
  OnlyOwner: true,
};
