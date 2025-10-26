import mess from "../../strings.js";
import { getProfilePictureUrl } from "../../lib/cache.js";

async function handle(sock, messageInfo) {
  const {
    remoteJid,
    message,
    sender,
    mentionedJid,
    content,
    isQuoted,
    senderType,
  } = messageInfo;

  try {
    let target;

    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    if (isQuoted) {
      target = isQuoted.sender;
    } else if (content && /^[0-9]{10,15}$/.test(content)) {
      target = `${content}@s.whatsapp.net`;
    } else {
      target =
        mentionedJid && mentionedJid.length > 0 ? mentionedJid[0] : sender;
    }

    // Dapatkan URL gambar profil
    const profilePictureUrl = await getProfilePictureUrl(sock, target);

    // Kirim pesan dengan gambar profil
    await sock.sendMessage(
      remoteJid,
      {
        image: { url: profilePictureUrl },
        caption: mess.general.success,
      },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error handling profile picture request:", error.message);

    await sock.sendMessage(
      remoteJid,
      {
        text: "⚠️ _Terjadi kesalahan saat menampilkan gambar profile._",
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["getpic"],
  OnlyPremium: false,
  OnlyOwner: false,
};
