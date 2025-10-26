import { listServer, deleteServer, panelReady } from "../../lib/panel.js";

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
    if (!content || content.toLowerCase() !== "-y") {
      await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ _Perintah ini akan menghapus seluruh data server._ \n\n_Silakan ketik *.${command} -y* untuk melanjutkan._`,
        },
        { quoted: message }
      );
      return;
    }

    // Kirim reaksi untuk memberi tahu bahwa proses sedang berjalan
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Mengambil daftar server
    const result = await listServer();
    let serverDeleted = 0;

    // Jika tidak ada server yang ditemukan
    if (!result.data || result.data.length === 0) {
      await sock.sendMessage(
        remoteJid,
        {
          text: "❌ Tidak ada server yang ditemukan untuk direset.",
        },
        { quoted: message }
      );
      return;
    }

    // Hapus semua server
    for (const server of result.data) {
      const { id } = server.attributes;
      try {
        await deleteServer(id);
        serverDeleted++;
      } catch (err) {
        console.error(`Gagal menghapus server dengan ID ${id}:`, err.message);
      }
    }

    // Kirim pesan selesai
    const msgResponse = `✅ _Server berhasil direset._\n\n${serverDeleted} server berhasil dihapus.`;
    await sock.sendMessage(
      remoteJid,
      {
        text: msgResponse,
      },
      { quoted: message }
    );
  } catch (error) {
    // Menangani error secara global dan mengirimkan pesan error
    console.error("Terjadi kesalahan saat mereset panel:", error);
    await sock.sendMessage(
      remoteJid,
      {
        text: `❌ Terjadi kesalahan: ${error.message || "Tidak diketahui"}`,
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["resetserver"],
  OnlyPremium: false,
  OnlyOwner: true,
};
