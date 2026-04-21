async function handle(sock, messageInfo) {
  const { remoteJid, message, sender, senderLid } = messageInfo;

  try {
    const text = [`${senderLid || '-'}`].join('\n');

    await sock.sendMessage(remoteJid, { text }, { quoted: message });
  } catch (error) {
    console.error('[LID ERROR]', error);

    await sock.sendMessage(remoteJid, { text: 'Maaf, terjadi kesalahan' }, { quoted: message });
  }
}

export default {
  handle,
  Commands: ['id'],
  OnlyPremium: false,
  OnlyOwner: false,
};
