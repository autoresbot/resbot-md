/*
⚠️ PERINGATAN:
Script ini **TIDAK BOLEH DIPERJUALBELIKAN** dalam bentuk apa pun!

╔══════════════════════════════════════════════╗
║                🛠️ INFORMASI SCRIPT           ║
╠══════════════════════════════════════════════╣
║ 📦 Version   : 5.0.0
║ 👨‍💻 Developer  : Azhari Creative              ║
║ 🌐 Website    : https://autoresbot.com       ║
║ 💻 GitHub  : github.com/autoresbot/resbot-md ║
╚══════════════════════════════════════════════╝

📌 Mulai 11 April 2025,
Script **Autoresbot** resmi menjadi **Open Source** dan dapat digunakan secara gratis:
🔗 https://autoresbot.com
*/

const mess = {
  game: {
    isPlaying:
      "⚠️ _Permainan sedang berlangsung._ Ketik *nyerah* untuk mengakhiri permainan.",
    isGroup: "⚠️ _Permainan hanya bisa dimainkan di grup_",
    isStop: "⚠️ _Fitur game dimatikan di grub ini_",
  },
  general: {
    isOwner: "⚠️ _Perintah ini Hanya Untuk Owner Bot._",
    isPremium: "⚠️ _Perintah ini Hanya Untuk pengguna premium._",
    isAdmin: "⚠️ _Perintah ini Hanya Untuk Admin_",
    isGroup: "⚠️ _Perintah ini Hanya digunakan di grup_",
    limit:
      "⚠️ _Limit kamu sudah habis_ \n\n_Ketik *.claim* untuk mendapatkan limit_ _Atau 💎 Berlangganan Member Premium agar limitmu tanpa batas_",
    success: "✅ _Success Kak_",
    isBlocked: "⚠️ _Kamu sedang di block dari penggunaan bot ini_", // kalau block seluruhnya
    isBaned: "⚠️ _Kamu sedang di ban pada grub ini_", // kalau ban hanya grub itu saja
    fiturBlocked: "⚠️ _Fitur sedang di ban di grub ini_",
  },
  action: {
    grub_open: "✅ Grup berhasil dibuka",
    grub_close: "✅ Grup berhasil ditutup",
    user_kick: "✅ _Berhasil mengeluarkan peserta dari grup._",
    mute: "_Grup telah berhasil di-mute. Semua perintah akan dinonaktifkan kecuali untuk menghidupkan kembali dengan mengetik_ *.unmute*.",
    unmute: "_Grup telah berhasil di-unmute. Semua perintah kembali aktif._",
    resetgc: "_Link Grub sudah di reset_",
  },
  handler: {
    // kosongkan jika tidak menggunakan notif = ''
    badword_warning:
      "⚠️ _*BADWORD TERDETEKSI*_ (@detectword)\n\n@sender _telah diperingati_ (@warning/@totalwarning)",
    badword_block:
      "⛔ @sender _Telah diblokir karena mengirim *BADWORD* secara berulang. (@detectword) Hubungi owner jika ada pertanyaan._",
    antiedit: "⚠️ _*ANTI EDIT DETECTED*_\n\n_Pesan Sebelumnya_ : @oldMessage",
    antidelete:
      "⚠️ _*ANTI DELETE DETECTED*_\n\n_Pengirim_ : @sender \n_Pesan Sebelumnya_ : @text",
    antispamchat:
      "⚠️ @sender _Jangan spam, ini peringatan ke-@warning dari @totalwarning._",
    antispamchat2:
      "⛔ @sender _Telah diblokir karena melakukan spam secara berulang. Hubungi owner jika ada pertanyaan._",
    antivirtex: "⚠️ @sender _Terdeteksi Mengirim Virtex._",
    antitagsw: "⚠️ @sender _Terdeteksi Tag Sw di grub ini_",
    antibot: "⚠️ @sender _Terdeteksi Adalah Bot_",
    afk: "🚫 *Jangan tag dia!*\n\n❏ _@sender sedang AFK sejak *@durasi*_@alasan",
    afk_message: "🕊️ @sender telah kembali dari AFK sejak _*@durasi*_.@alasan",
    sewa_notif: "⚠️ _*Peringatan!*_\n\n_Masa Sewabot :_ @date",
    sewa_out: `❌ _*Masa SewaBOT Telah Habis*_\n_Bot akan keluar otomatis_\n\nTerima kasih sudah menggunakan layanan sewa autoresbot.\n\n*Nomor Owner*\nwa.me/@ownernumber`,
  },
  game_handler: {
    menyerah:
      "Yahh Menyerah\nJawaban: @answer\n\nIngin bermain? Ketik *@command*",
    waktu_habis: "⏳ Waktu habis! Jawabannya : @answer",
    tebak_angka:
      "🎉 Selamat! Tebakan Anda benar. Anda mendapatkan @hadiah Money.",
    tebak_bendera:
      "🎉 Selamat! Tebakan Anda benar. Anda mendapatkan @hadiah Money.",
    tebak_gambar:
      "🎉 Selamat! Tebakan Anda benar. Anda mendapatkan @hadiah Money.",
    tebak_hewan:
      "🎉 Selamat! Tebakan Anda benar. Anda mendapatkan @hadiah Money.",
    tebak_kalimat:
      "🎉 Selamat! Tebakan Anda benar. Anda mendapatkan @hadiah Money.",
    tebak_kata:
      "🎉 Selamat! Tebakan Anda benar. Anda mendapatkan @hadiah Money.",
    tebak_lagu:
      "🎉 Selamat! Tebakan Anda benar. Anda mendapatkan @hadiah Money.",
    tebak_lirik:
      "🎉 Selamat! Tebakan Anda benar. Anda mendapatkan @hadiah Money.",
  },
};

// Variable
global.group = {};
global.group.variable = `
☍ @name
☍ @date
☍ @day
☍ @desc
☍ @group
☍ @greeting
☍ @size
☍ @time`;

export default mess;
