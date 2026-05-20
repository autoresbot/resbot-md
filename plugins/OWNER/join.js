async function handle(sock, messageInfo) {
  const { remoteJid, message, content, sender, prefix, command } = messageInfo;

  try {
    // Validasi input kosong atau tidak sesuai format
    if (
      !content ||
      content.trim() === "" ||
      !content.includes("whatsapp.com")
    ) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
            prefix + command
          } https://chat.whatsapp.com/xxx*_`,
        },
        { quoted: message }
      );
    }

    // Kirim reaksi ⏰ untuk menunjukkan sedang memproses
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Ekstrak ID grup dari tautan
    const groupIdRaw = content.split("chat.whatsapp.com/")[1];
  const groupId = groupIdRaw ? groupIdRaw.split("?")[0] : null;
    if (!groupId) {
      return await sock.sendMessage(
        remoteJid,
        { text: `⚠️ Tautan grup tidak valid.` },
        { quoted: message }
      );
    }

    // Bergabung ke grup menggunakan invite link
    try {
      await sock.groupAcceptInvite(groupId);
      await sock.sendMessage(
        remoteJid,
        { text: `✅ Berhasil bergabung ke grup.` },
        { quoted: message }
      );
    } catch (error) {
      let info = "_Pastikan link grup valid._";

      // Periksa pesan error
      if (error instanceof Error && error.message.includes("not-authorized")) {
        info = `_Kemungkinan Anda pernah dikeluarkan dari grup. Solusi: undang bot kembali atau masukkan secara manual._`;
      }

      if (error instanceof Error && error.message.includes("conflict")) {
        info = `_Bot Sudah berada di dalam grub sebelumnya_`;
      }

      // Kirim pesan error ke pengguna
      return await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ _Gagal bergabung ke grup._\n\n${info}`,
        },
        { quoted: message }
      );
    }
  } catch (error) {
    console.error("Terjadi kesalahan:", error);
    await sock.sendMessage(
      remoteJid,
      { text: `⚠️ Terjadi kesalahan saat memproses perintah.` },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["join"],
  OnlyPremium: false,
  OnlyOwner: true,
};
