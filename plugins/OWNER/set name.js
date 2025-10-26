async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;

  try {
    // Validasi input nama
    if (!content || !content.trim()) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
            prefix + command
          } resbot 4.0*_`,
        },
        { quoted: message }
      );
    }

    // Perbarui nama profil bot
    await sock.updateProfileName(content);

    // Kirim pesan sukses
    return await sock.sendMessage(
      remoteJid,
      { text: `_Sukses mengganti nama bot ke *${content}*_` },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error processing message:", error);

    // Kirim pesan error
    return await sock.sendMessage(
      remoteJid,
      { text: "Terjadi kesalahan saat memproses pesan." },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["setname"],
  OnlyPremium: false,
  OnlyOwner: true,
};
