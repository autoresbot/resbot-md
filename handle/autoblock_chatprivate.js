const respondedSenders = new Set();

async function process(sock, messageInfo) {
  const { sender, remoteJid, isGroup } = messageInfo;

  // KOMENTARI INI UNTUK MENGHIDUPKAN

  return true;

  if (isGroup) return true; // Abaikan jika pesan berasal dari grup
  if (remoteJid == "status@broadcast") return true; // abaikan story

  if (respondedSenders.has(sender)) return true;

  try {
    //await sock.sendMessage(sender, { text: 'Kata kata hari ini' }, { quoted: message });

    await sock.updateBlockStatus(sender, "block");

    // Tandai pengirim sudah di block
    respondedSenders.add(sender);
  } catch (error) {
    console.error("Error in block user:", error);
  }
  return true;
}
export default {
  name: "Autoblock Chat Pribadi",
  priority: 10,
  process,
};
