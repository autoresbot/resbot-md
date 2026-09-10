import { listSewa } from "../../lib/sewa.js";

async function handle(sock, messageInfo) {
  const { remoteJid } = messageInfo;

  try {
    const sewa = await listSewa();

    // Jika tidak ada list
    if (!sewa || Object.keys(sewa).length === 0) {
      await sock.sendMessage(remoteJid, {
        text: "⚠️ _Tidak Ada daftar sewa ditemukan_",
      });
      return;
    }

    const listMessage = `*Total : ${Object.keys(sewa).length}*`;

    // Kirim pesan daftar sewa
    await sock.sendMessage(remoteJid, {
      text: listMessage,
    });
  } catch (error) {
    await sock.sendMessage(remoteJid, {
      text: "_Terjadi kesalahan saat mengambil daftar sewa_",
    });
  }
}

export default {
  handle,
  Commands: ["totalsewa"],
  OnlyPremium: false,
  OnlyOwner: true,
};
