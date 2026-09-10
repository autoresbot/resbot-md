import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, prefix, command, content } = messageInfo;

  try {
    if (!content.trim()) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
            prefix + command
          } hantu*_`,
        },
        { quoted: message }
      );
    }

    // Loading
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const api = new ApiAutoresbot(config.APIKEY);

    // Memanggil API dengan penanganan kesalahan dan pengecekan respons
    const response = await api.get("/api/primbon/tafsirmimpi", {
      text: content,
    });

    if (response && response.data) {
      // Mengirim pesan jika data dari respons tersedia
      await sock.sendMessage(
        remoteJid,
        { text: response.data },
        { quoted: message }
      );
    } else {
      // Mengirim pesan default jika respons data kosong atau tidak ada
      await sock.sendMessage(
        remoteJid,
        { text: "Maaf, tidak ada respons dari server." },
        { quoted: message }
      );
    }
  } catch (error) {
    // Memberi tahu pengguna jika ada kesalahan
    await sock.sendMessage(
      remoteJid,
      {
        text: `Maaf, terjadi kesalahan saat memproses permintaan Anda. Coba lagi nanti.\n\n${error}`,
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["artimimpi"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
