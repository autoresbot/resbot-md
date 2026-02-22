const fs = require('fs');
const path = require('path');
const axios = require('axios');
const unzipper = require('unzipper');
const fse = require('fs-extra');

const serverUrl = `https://github.com/autoresbot/resbot-md/archive/refs/heads/master.zip`;

const WHITELIST_FILE = ['config.js', 'strings.js', 'database'];

async function handle(sock, messageInfo) {
    const { remoteJid, message } = messageInfo;

    await sock.sendMessage(remoteJid, { react: { text: "⏳", key: message.key } });

    try {

        const zipPath = path.join(process.cwd(), 'update.zip');
        const extractPath = path.join(process.cwd(), 'update_temp');

        // 1️⃣ Download ZIP
        const response = await axios({
            method: 'GET',
            url: serverUrl,
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(zipPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // 2️⃣ Extract
        await fs.createReadStream(zipPath)
            .pipe(unzipper.Extract({ path: extractPath }))
            .promise();

        const extractedFolder = fs.readdirSync(extractPath)[0];
        const sourceBase = path.join(extractPath, extractedFolder);
        const targetBase = process.cwd();

        const items = fs.readdirSync(sourceBase);

        for (let item of items) {

            if (WHITELIST_FILE.includes(item)) {
                console.log(`⚠️ Skip whitelist: ${item}`);
                continue;
            }

            const sourcePath = path.join(sourceBase, item);
            const targetPath = path.join(targetBase, item);

            if (fs.existsSync(targetPath)) {
                await fse.remove(targetPath);
            }

            await fse.copy(sourcePath, targetPath);
        }

        // Cleanup
        await fse.remove(zipPath);
        await fse.remove(extractPath);

        await sock.sendMessage(remoteJid, {
            text: `✅ *Update berhasil!*\n\nFile/Folder yang tidak diganti:\n${WHITELIST_FILE.map(v => "- " + v).join("\n")}\n\nSilakan restart bot.`,
            quoted: message
        });

    } catch (error) {
        console.error("Update Error:", error);
        await sock.sendMessage(remoteJid, {
            text: `❌ Gagal melakukan update.`,
            quoted: message
        });
    }
}

module.exports = {
    handle,
    Commands: ['update'],
    OnlyPremium: false,
    OnlyOwner: true
};