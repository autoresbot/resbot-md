import { deleteServer, saveServer , panelReady } from "../../lib/panel.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;

  try {

        // Periksa apakah panel siap digunakan
    const isConfigReady = await panelReady();
    if (!isConfigReady) {
      await sock.sendMessage(
        remoteJid,
        {
          text: "⚠️ _Konfigurasi panel belum selesai._\n\n_Silakan lengkapi bagian :_ *PANEL_URL*, *PANEL_PLTA*, dan *PANEL_ID_EGG* _di file *config.js*_.\n\n_Pastikan Anda adalah pemilik *server panel* atau *admin panel* untuk mendapatkan informasi tersebut._",
        },
        { quoted: message }
      );

      return;
    }



    // Validasi input konten
    if (!content || isNaN(content) || Number(content) <= 0) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `_Contoh: *${prefix + command} 1*_ (Gunakan id server)`,
        },
        { quoted: message }
      );
      return;
    }

    // Validasi lolos, kirim reaksi
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Panggil fungsi deleteUser
    const result = await deleteServer(Number(content));

    if (result) {
      await saveServer();
    }

    // Berikan respons sukses
    await sock.sendMessage(
      remoteJid,
      {
        text: `✅ Server berhasil dihapus`,
      },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error in handle function:", error);

    // Ambil pesan error dari properti `errors` jika ada
    let errorMessage = "❌ Terjadi kesalahan saat menghapus server.\n";
    if (error.errors && Array.isArray(error.errors)) {
      errorMessage += "\n";
      error.errors.forEach((err) => {
        errorMessage += `- ${err.detail}\n`;
      });
    }

    // Kirim pesan error ke pengguna
    try {
      await sock.sendMessage(
        remoteJid,
        {
          text: errorMessage.trim(),
        },
        { quoted: messageInfo?.message }
      );
    } catch (sendError) {
      console.error("Error sending error message:", sendError);
    }
  }
}

export default {
  handle,
  Commands: ["delserver", "deleteserver"],
  OnlyPremium: false,
  OnlyOwner: true,
};
