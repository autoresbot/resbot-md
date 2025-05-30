const { removeUser, getUser, isUserPlaying } = require("@tmpDB/math");
const { addUser, updateUser, deleteUser, findUser } = require("@lib/users");



async function process(sock, messageInfo) {
    const { remoteJid, content ,fullText, message, sender } = messageInfo;

    if (isUserPlaying(remoteJid)) {
        const data = getUser(remoteJid);

        // Ketika menyerah
        if(fullText.toLowerCase().includes('nyerah')){
            if (data && data.timer) {
                clearTimeout(data.timer);
            }
            removeUser(remoteJid);
            await sock.sendMessage(remoteJid, {
                text: `Yahh Menyerah\nJawaban: ${data.jawaban}\n\nIngin bermain? Ketik *.math*`,
            }, { quoted: message });
        }
        if (fullText.toLowerCase() == data.jawaban) {
            const hadiah = data.hadiah;
            if (data && data.timer) {
                clearTimeout(data.timer);
            }

            // Mencari pengguna
            const user = await findUser(sender);

            if (user) {
                const moneyAdd = (user.money || 0) + hadiah; // Default money ke 0 jika undefined
                await updateUser(sender, { money: moneyAdd });
            } else {
                await addUser(sender, {
                    money: hadiah,
                    role: "user",
                    status: "active",
                });
            }

            removeUser(remoteJid);
            await sock.sendMessage(remoteJid, {
                text: `🎉 Selamat! Jawaban Anda benar. Anda mendapatkan ${hadiah} Money.`,
            }, { quoted: message });
        }
    }

    return true; // Lanjutkan ke plugin berikutnya
}

module.exports = {
    name: "Math",
    priority : 10,
    process,
};
