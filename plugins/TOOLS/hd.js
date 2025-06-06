const { downloadQuotedMedia, downloadMedia, reply, uploadTmpFile } = require('@lib/utils');
const fs = require('fs');
const path = require('path');
const mess = require('@mess');
const ApiAutoresbot = require("api-autoresbot");
const config = require("@config");

async function handle(sock, messageInfo) {
    const { m, remoteJid, message, content, prefix, command, type, isQuoted } = messageInfo;

    try {
        const mediaType = isQuoted ? isQuoted.type : type;
        if (mediaType !== 'image') {
            return await reply(m, `⚠️ _Kirim/Balas gambar dengan caption *${prefix + command}*_`);
        }

        // Tampilkan reaksi "Loading"
        await sock.sendMessage(remoteJid, { react: { text: "⏰", key: message.key } });

        // Download & Upload media
        const media = isQuoted
            ? await downloadQuotedMedia(message)
            : await downloadMedia(message);
        const mediaPath = path.join('tmp', media);

        if (!fs.existsSync(mediaPath)) {
            throw new Error('File media tidak ditemukan setelah diunduh.');
        }

        const upload = await uploadTmpFile(mediaPath)
        if(upload.status) {
            const url = upload.fileUrl

            const api = new ApiAutoresbot(config.APIKEY);
                            
            const MediaBuffer = await api.getBuffer('/api/tools/remini', { url });
            
            if (!Buffer.isBuffer(MediaBuffer)) {
                throw new Error('Invalid response: Expected Buffer.');
            }

            await sock.sendMessage(
                remoteJid,
                {
                    image: MediaBuffer,
                    caption: mess.general.success,
                },
                { quoted: message }
            );

        }else {
            const errorMessage = `_Terjadi kesalahan saat upload ke gambar._ \n\nERROR : ${error}`;
            await reply(m, errorMessage);
        }

    
    } catch (error) {
        // Kirim pesan kesalahan yang lebih informatif
        const errorMessage = `_Terjadi kesalahan saat memproses gambar._ \n\nERROR : ${error}`;
        await reply(m, errorMessage);
    }
}

module.exports = {
    handle,
    Commands    : ['hd', 'remini'], // Perintah yang diproses oleh handler ini
    OnlyPremium : false,
    OnlyOwner   : false,
    limitDeduction  : 1, // Jumlah limit yang akan dikurangi
};