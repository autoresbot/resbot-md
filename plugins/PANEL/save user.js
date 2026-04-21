import { saveUser, panelReady } from "../../lib/panel.js";

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


    
    // Kirim reaksi untuk memberi tahu bahwa proses sedang berjalan
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Panggil fungsi saveUser untuk menyimpan pengguna
    const result = await saveUser(); // Mengeksekusi penyimpanan pengguna

    if (result) {
      // Jika berhasil, kirim pesan dengan jumlah pengguna yang disimpan
      await sock.sendMessage(
        remoteJid,
        {
          text: `✅ Berhasil menyimpan ${result} pengguna.`,
        },
        { quoted: message }
      );
    } else {
      // Jika tidak ada data yang disimpan atau hasilnya kosong
      await sock.sendMessage(
        remoteJid,
        {
          text: "❌ Tidak ada pengguna yang disimpan. Pastikan data pengguna tersedia.",
        },
        { quoted: message }
      );
    }
  } catch (error) {
    console.error("Error in handle function:", error);

    // Mengirimkan pesan error ke pengguna
    await sock.sendMessage(
      remoteJid,
      {
        text:
          error.message || "❌ Terjadi Kesalahan saat menyimpan data pengguna.",
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["saveuser"],
  OnlyPremium: false,
  OnlyOwner: true,
};
