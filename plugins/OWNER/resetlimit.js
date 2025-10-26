import { resetLimit } from "../../lib/users.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message } = messageInfo;
  try {
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    await resetLimit();

    await sock.sendMessage(
      remoteJid,
      { text: "✅ _Semua Limit Users telah direset_" },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error during database reset:", error);
    await sock.sendMessage(
      remoteJid,
      { text: "_❌ Maaf, terjadi kesalahan saat mereset data._" },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["resetlimit"],
  OnlyPremium: false,
  OnlyOwner: true,
};
