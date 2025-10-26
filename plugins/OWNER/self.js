import { findGroup, updateGroup, deleteGroup } from "../../lib/group.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, command } = messageInfo;

  try {
    // Cari data grup berdasarkan ID
    const dataGroup = await findGroup("owner", true);

    const isSelf = dataGroup?.fitur?.self;

    // Variabel untuk respon dan pembaruan data
    let responseText = "";
    let updateData = null;

    // Respon berdasarkan perintah
    switch (command) {
      case "self":
        updateData = { fitur: { self: true } };
        responseText =
          "_Bot berhasil di-self. Bot hanya dapat digunakan oleh owner. Untuk menjadikannya agar semua orang bisa menggunakan ketik_ *.public*.";
        if (isSelf) {
          responseText = "_Bot Sebelumnya sudah self_";
        }

        break;

      case "public":
        if (dataGroup) {
          await deleteGroup("owner");
        } else {
          responseText = "_Bot Sebelumnya sudah public_";
          return await sock.sendMessage(
            remoteJid,
            { text: responseText },
            { quoted: message }
          );
        }
        updateData = { fitur: { public: false } };
        responseText = "_Bot berhasil diatur menjadi public._";
        break;

      default:
        responseText = "_Perintah tidak dikenali._";
    }

    // Perbarui data grup jika ada perubahan
    if (updateData) {
      const dataGroup2 = await findGroup("owner");
      if (dataGroup2) {
        await updateGroup("owner", updateData);
      }
    }

    // Kirim pesan ke grup
    await sock.sendMessage(
      remoteJid,
      { text: responseText },
      { quoted: message }
    );
  } catch (error) {
    // Tangani kesalahan
    console.error(error.message);
    await sock.sendMessage(
      remoteJid,
      { text: "Terjadi kesalahan saat memproses perintah. Silakan coba lagi." },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["self", "public"],
  OnlyPremium: false,
  OnlyOwner: true,
};
