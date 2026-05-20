const respondedSenders = new Set();

// ====================================
// CONFIG
// ====================================
const config = {
  enabled: false, // true = ON | false = OFF
  text: 'Kata kata hari ini',
};

async function process(sock, messageInfo) {
  const { sender, remoteJid, isGroup, message } = messageInfo;

  // Feature OFF
  if (!config.enabled) return true;

  // Abaikan grup & status
  if (isGroup) return true;
  if (remoteJid === 'status@broadcast') return true;

  // Hindari spam ke sender yang sama
  if (respondedSenders.has(sender)) return true;

  try {
    // Kirim pesan
    await sock.sendMessage(sender, { text: config.text }, { quoted: message });

    respondedSenders.add(sender);
  } catch (error) {
    console.error('Error:', error);
  }

  return true;
}

export default {
  name: 'Autoreply Chat Pribadi',
  priority: 10,
  process,
};
