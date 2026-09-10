import { listUser, panelReady } from "../../lib/panel.js";

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



    // Kirim reaksi untuk memberi tahu bahwa data sedang diproses
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    let page;
    if (content && !isNaN(content) && Number(content) > 0) {
      page = Number(content); // Gunakan nilai dari content jika valid
    } else {
      page = 1; // Default ke halaman 1 jika tidak valid
    }

    const result = await listUser(page);

    // Periksa apakah ada data pengguna
    if (!result.data || result.data.length === 0) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ Tidak ada data pengguna yang ditemukan.`,
        },
        { quoted: message }
      );
      return;
    }

    // Format daftar pengguna
    let userList = "📋 *Daftar Pengguna:*\n\n";
    result.data.forEach((user, index) => {
      const { attributes } = user;
      const username = attributes.username || "Tidak ada nama";
      const email = attributes.email || "Tidak ada email";
      const id = attributes.id || "Tidak ada id";

      userList += `*${index + 1}. ID:* ${id}\n`;
      userList += `   *Nama:* ${username}\n`;
      userList += `   *Email:* ${email}\n\n`;
    });

    if (result.data.length >= 50) {
      userList += `"_📄 Setiap halaman menampilkan hingga 50 pengguna. Untuk melihat halaman berikutnya, gunakan perintah:_ .listuser [nomor halaman] Contoh: _*.listuser 2*_"`;
    }

    // Kirim daftar pengguna
    await sock.sendMessage(
      remoteJid,
      {
        text: userList.trim(),
      },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error in handle function:", error);

    // Ambil pesan error dari properti `errors` jika ada
    let errorMessage = "❌ Terjadi kesalahan saat mengambil daftar pengguna.\n";
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
  Commands: ["listuser"],
  OnlyPremium: false,
  OnlyOwner: true,
};
