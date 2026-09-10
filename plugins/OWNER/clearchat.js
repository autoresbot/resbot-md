async function delay(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration * 1000));
}

// Fungsi utama
const clearAllChats = async (sock) => {
  let cleared = 0;

  try {
    // Daftar chat dimuat ulang dulu dari store zapo — `sock.chats` hanya cermin
    // in-memory dan bisa tertinggal kalau bot baru saja tersambung.
    await sock.refreshChats?.();

    // Ambil semua JID chat, kalau tidak ada isi dengan array kosong
    const chats = Object.keys(sock.chats || {});

    if (chats.length === 0) {
      console.log("⚠️ Tidak ada chat yang bisa dihapus.");
      return cleared;
    }

    for (const jid of chats) {
      try {
        // 1. Bersihkan isi pesan chat
        await sock.chatModify({ clear: { type: "all" } }, jid);

        await delay(300); // jeda supaya aman dari rate limit

        // 2. Hapus chat dari daftar
        await sock.chatModify({ delete: true }, jid);

        cleared++;
        console.log(`✅ Chat ${jid} dibersihkan & dihapus`);
      } catch (err) {
        console.error(`⚠️ Gagal hapus chat ${jid}:`, err.message);
      }
    }

    console.log("🎉 Semua chat sudah dibersihkan!");
  } catch (err) {
    console.error("❌ Gagal membersihkan semua chat:", err.message);
  }

  return cleared;
};

async function handle(sock, messageInfo) {
  const { remoteJid } = messageInfo;

  await sock.sendMessage(remoteJid, {
    text: "⏳ Sedang menghapus semua chat...",
  });
  const cleared = await clearAllChats(sock);

  // Dulu pesan ini selalu bilang "berhasil" walau tidak ada chat yang tersentuh.
  await sock.sendMessage(remoteJid, {
    text: cleared
      ? `✅ ${cleared} chat berhasil dihapus total!`
      : "⚠️ Tidak ada chat yang bisa dihapus.\n\n_Daftar chat baru terisi setelah bot menerima pesan atau selesai sinkronisasi._",
  });
}

export default {
  handle,
  Commands: ["clearchat"],
  OnlyPremium: false,
  OnlyOwner: true,
};
