async function handle(sock, messageInfo) {
  const { remoteJid, message, isQuoted, prefix, command } = messageInfo;

  try {
    if (!isQuoted) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ _Balas stiker yang ingin Anda kirim ulang dengan caption *${prefix + command}*_`,
        },
        { quoted: message },
      );
      return;
    }

    const quotedMessageType = isQuoted.type;

    if (quotedMessageType === 'sticker') {
      const stickerContentData = isQuoted.content;

      const stickerData = {
        url: stickerContentData.url,
        fileSha256: stickerContentData.fileSha256,
        fileEncSha256: stickerContentData.fileEncSha256,
        mediaKey: stickerContentData.mediaKey,
        mimetype: stickerContentData.mimetype,
        height: stickerContentData.height,
        width: stickerContentData.width,
        directPath: stickerContentData.directPath,
        fileLength: stickerContentData.fileLength,
        mediaKeyTimestamp: stickerContentData.mediaKeyTimestamp,
        isAnimated: stickerContentData.isAnimated || false,
        stickerSentTs: stickerContentData.stickerSentTs || Date.now(),
        isAvatar: stickerContentData.isAvatar || false,
        isAiSticker: stickerContentData.isAiSticker || false,
        isLottie: stickerContentData.isLottie || false,
        premium: 1,
      };

      const stickerMessage = {
        stickerMessage: stickerData,
      };

      const msg = {
        messageContextInfo: {
          messageSecret: 'rme8dNt3wUoOXIqw5rIpoHsnCSGJtcy/kMJVsBfyukA=',
        },
        lottieStickerMessage: {
          message: stickerMessage,
        },
      };

      await sock.relayMessage(remoteJid, msg, {});
    } else {
      await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ _Balas stiker untuk menggunakan perintah *${prefix + command}*_`,
        },
        { quoted: message },
      );
    }
  } catch (error) {
    console.error('Terjadi kesalahan saat memproses stiker premium:', error);

    await sock.sendMessage(
      remoteJid,
      {
        text: 'Maaf, terjadi kesalahan saat memproses stiker. Coba lagi nanti!',
      },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['sprem', 'stickerpremium'],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
