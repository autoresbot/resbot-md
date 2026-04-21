async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message } = messageInfo;
  if (!isGroup) return; // Only Grub

  await sock.sendMessage(
    remoteJid,
    { text: `Helo ada yang bisa di bantu ?` },
    { quoted: message }
  );
}
export default {
  handle,
  Commands: ["bot"],
  OnlyPremium: false,
  OnlyOwner: false,
};
