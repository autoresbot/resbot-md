function getGreeting() {
  const now = new Date();
  const utcHours = now.getUTCHours(); // Jam UTC
  const wibHours = (utcHours + 7) % 24;
  // Tentukan file audio berdasarkan jam
  let fileName;
  if (wibHours >= 3 && wibHours <= 5) {
    fileName = "https://api.autoresbot.com/mp3/azan-subuh.m4a";
  } else {
    fileName = "https://api.autoresbot.com/mp3/azan-umum.m4a";
  }
  return fileName;
}

async function handle(sock, messageInfo) {
  const { remoteJid, message } = messageInfo;

  try {
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const audioUrl = getGreeting();
    await sock.sendMessage(
      remoteJid,
      {
        audio: { url: audioUrl },
        mimetype: "audio/mp4",
      },
      { quoted: message }
    );
  } catch (e) {
    return await sock.sendMessage(remoteJid, {
      react: { text: "⛔", key: message.key },
    });
  }
}

export default {
  handle,
  Commands: ["azan"],
  OnlyPremium: false,
  OnlyOwner: false,
};
