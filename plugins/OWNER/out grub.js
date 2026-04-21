async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command, sender } = messageInfo;

  try {
    // Validasi format input
    if (!content.trim() || !content.includes("@g.us")) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ _Format tidak valid._\n\nSilakan ketik: *.${command} IDGRUB*\n\nContoh: ${
            prefix + command
          } 120363204743427585@g.us`,
        },
        { quoted: message }
      );
      return;
    }

    // Mencoba keluar dari grup
    try {
      await sock.groupLeave(content);
      await sock.sendMessage(
        remoteJid,
        {
          text: `✅ _Berhasil keluar dari grup dengan ID: *${content}*_`,
        },
        { quoted: message }
      );
    } catch (err) {
      console.error("Gagal keluar dari grup:", err);
      await sock.sendMessage(
        remoteJid,
        {
          text: "⚠️ Keluar dari grup gagal. Pastikan ID grup benar atau bot memiliki izin yang cukup.",
        },
        { quoted: message }
      );
    }
  } catch (error) {
    // Kirim pesan kesalahan umum
    await sock.sendMessage(
      remoteJid,
      {
        text: "⚠️ _Terjadi kesalahan saat memproses permintaan Anda._",
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["outgrup", "outgroup", "outgrub", "outgroub", "outgc"],
  OnlyPremium: false,
  OnlyOwner: true,
};
