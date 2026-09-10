async function handle(sock, messageInfo) {
  const { remoteJid, message } = messageInfo;

  try {
    await sock.sendMessage(remoteJid, {
      react: { text: "✅", key: message.key },
    });
  } catch (error) {
    await sock.sendMessage(remoteJid, {
      react: { text: "⚠️", key: message.key },
    });
  }
}

export default {
  handle,
  Commands: ["ping2"],
  OnlyPremium: false,
  OnlyOwner: false,
};
