async function delay(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration * 1000));
}

// Fungsi utama
const clearAllChats = async (sock) => {
  try {
    // Ambil semua JID chat, kalau tidak ada isi dengan array kosong
    const chats = Object.keys(sock.chats || {});

    if (chats.length === 0) {
      console.log("⚠️ Tidak ada chat yang bisa dihapus.");
      return;
    }

    for (const jid of chats) {
      try {
        // 1. Bersihkan isi pesan chat
        await sock.chatModify({ clear: { type: "all" } }, jid);

        await delay(300); // jeda supaya aman dari rate limit

        // 2. Hapus chat dari daftar
        await sock.chatModify({ delete: true }, jid);

        console.log(`✅ Chat ${jid} dibersihkan & dihapus`);
      } catch (err) {
        console.error(`⚠️ Gagal hapus chat ${jid}:`, err.message);
      }
    }

    console.log("🎉 Semua chat sudah dibersihkan!");
  } catch (err) {
    console.error("❌ Gagal membersihkan semua chat:", err.message);
  }
};

async function handle(sock, messageInfo) {
  const { remoteJid } = messageInfo;

  await sock.sendMessage(remoteJid, {
    text: "⏳ Sedang menghapus semua chat...",
  });
  await clearAllChats(sock);
  await sock.sendMessage(remoteJid, {
    text: "✅ Semua chat berhasil dihapus total!",
  });
}

export default {
  handle,
  Commands: ["clearchat"],
  OnlyPremium: false,
  OnlyOwner: true,
};
