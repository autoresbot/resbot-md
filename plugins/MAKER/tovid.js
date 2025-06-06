const { downloadQuotedMedia, downloadMedia } = require("@lib/utils");
const { sendImageAsSticker } = require("@lib/exif");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const ApiAutoresbot = require("api-autoresbot");
const config = require("@config");

async function handle(sock, messageInfo) {
    const { remoteJid, message, type, isQuoted, content, prefix, command } = messageInfo;

    try {
        await sock.sendMessage(remoteJid, { react: { text: "⏰", key: message.key } });
        const mediaType = isQuoted ? isQuoted.type : type;

        if (mediaType === "image" || mediaType === 'sticker') {
            const media = isQuoted
                ? await downloadQuotedMedia(message)
                : await downloadMedia(message);

            const mediaPath = path.join("tmp", media);
            if (!fs.existsSync(mediaPath)) {
                throw new Error("File media tidak ditemukan setelah diunduh.");
            }

            const api = new ApiAutoresbot(config.APIKEY);
            const response = await api.tmpUpload(mediaPath);

            if (!response || response.code !== 200) {
                throw new Error("File upload gagal atau tidak ada URL.");
            }
            const url = response.data.url;
            const buffer = await api.getBuffer("/api/convert/webptovideo", {
                url
            });

            if(command == 'togif') {
                await sock.sendMessage(remoteJid, { 
                    video: buffer,
                    gifPlayback: true, // Menjadikan video sebagai GIF
                    caption: ''
                });
                return
            }
            await sock.sendMessage(remoteJid, { 
                video: buffer,
                caption: ''
            });


        }else {
            return await sock.sendMessage(
                remoteJid,
                { text:`⚠️ _Kirim/Balas media dengan caption *${prefix + command}*_` },
                { quoted: message }
            );
        }
    } catch (error) {
        console.log(error)
        await sock.sendMessage(
            remoteJid,
            { text: "Maaf, terjadi kesalahan. Coba lagi nanti!" },
            { quoted: message }
        );
    }
}

module.exports = {
    handle,
    Commands        : ["tovid","togif"],
    OnlyPremium     : false,
    OnlyOwner       : false,
    limitDeduction  : 1
};
