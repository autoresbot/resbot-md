import fs from 'fs';
import path from 'path';
import axios from 'axios';
import unzipper from 'unzipper';
import fse from 'fs-extra';
import { fileURLToPath } from 'url';

// Fix __dirname di ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverUrl = 'https://github.com/autoresbot/resbot-md/archive/refs/heads/master.zip';
const VERSION_URL = 'https://raw.githubusercontent.com/autoresbot/resbot-md/master/version.txt';

const WHITELIST_FILE = ['config.js', 'strings.js', 'database'];

export async function handle(sock, messageInfo) {
  const { remoteJid, message } = messageInfo;

  await sock.sendMessage(remoteJid, {
    react: { text: '⏳', key: message.key },
  });

  try {
    // ===== CHECK VERSION =====
    const localVersionPath = path.join(process.cwd(), 'version.txt');

    let localVersion = '0.0.0';
    if (fs.existsSync(localVersionPath)) {
      localVersion = fs.readFileSync(localVersionPath, 'utf-8').trim();
    }

    // Ambil versi terbaru dulu
    const versionResponse = await axios.get(VERSION_URL, { timeout: 10000 });
    const remoteVersion = versionResponse.data.trim();

    if (!remoteVersion) {
      throw new Error('Remote version kosong');
    }

    if (localVersion === remoteVersion) {
      await sock.sendMessage(remoteJid, {
        text: `✅ Versi anda sudah terbaru (${localVersion})`,
        quoted: message,
      });
      return;
    }

    const zipPath = path.join(process.cwd(), 'update.zip');
    const extractPath = path.join(process.cwd(), 'update_temp');

    // 1️⃣ Download ZIP
    const response = await axios({
      method: 'GET',
      url: serverUrl,
      responseType: 'stream',
      timeout: 60000,
    });

    const writer = fs.createWriteStream(zipPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // 2️⃣ Extract ZIP
    await fs
      .createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: extractPath }))
      .promise();

    const extractedFolders = fs.readdirSync(extractPath);
    if (!extractedFolders.length) {
      throw new Error('Folder hasil extract tidak ditemukan');
    }

    const sourceBase = path.join(extractPath, extractedFolders[0]);
    const targetBase = process.cwd();

    const items = fs.readdirSync(sourceBase);

    for (let item of items) {
      if (WHITELIST_FILE.includes(item)) {
        //console.log(`⚠️ Skip whitelist: ${item}`);
        continue;
      }

      const sourcePath = path.join(sourceBase, item);
      const targetPath = path.join(targetBase, item);

      await fse.copy(sourcePath, targetPath, {
        overwrite: true,
        errorOnExist: false,
      });
    }

    // 3️⃣ Update version.txt
    fs.writeFileSync(localVersionPath, remoteVersion);

    // Cleanup
    await fse.remove(zipPath);
    await fse.remove(extractPath);

    await sock.sendMessage(remoteJid, {
      text:
        `✅ *Update berhasil!*\n\n` +
        `Versi lama : ${localVersion}\n` +
        `Versi baru : ${remoteVersion}\n\n` +
        `Tidak mengganti:\n${WHITELIST_FILE.map((v) => '- ' + v).join('\n')}\n\n` +
        `Silakan restart bot.`,
      quoted: message,
    });
  } catch (error) {
    console.error('Update Error:', error);

    await sock.sendMessage(remoteJid, {
      text: `❌ Gagal melakukan update.\n${error.message}`,
      quoted: message,
    });
  }
}

export const Commands = ['update'];
export const OnlyPremium = false;
export const OnlyOwner = true;
