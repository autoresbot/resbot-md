import { reply } from "../../lib/utils.js";
import { findUser, updateUser } from "../../lib/users.js";

async function handle(sock, messageInfo) {
  const { m, prefix, command, content, mentionedJid, senderType } = messageInfo;

  const extSender = senderType === "user" ? "@whatsapp.net" : "@lid";

  try {
    // Validasi input kosong
    if (!content || !content.trim()) {
      return await reply(
        m,
        `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${prefix + command} 628xxx*_
                
_Fitur *block* akan membuat user tidak dapat menggunakan bot di semua grub dan chat pribadi_

_gunakan fitur *ban* untuk memblokir user di grub ini saja_`
      );
    }

    // Tentukan nomor target
    let targetNumber = (mentionedJid?.[0] || content).replace(/\D/g, "");
    const originalNumber = targetNumber;

    // Ambil data user dari database
    const dataUsers = await findUser(originalNumber);

    if (!dataUsers) {
      return await reply(
        m,
        `_⚠️ Nomor ${originalNumber} tidak ditemukan di database._\n\n` +
          `_Pastikan nomor yang dimasukkan benar dan terdaftar dalam database._`
      );
    }
    // Perbarui status pengguna menjadi "block"
    await updateUser(originalNumber, { status: "block" });
    await sock.updateBlockStatus(`${targetNumber}${extSender}`, "block");
    return await reply(
      m,
      `_✅ Nomor ${originalNumber} berhasil diblokir!_\n\n` +
        `_⚠️ Info: Nomor yang telah diblokir tidak dapat menggunakan semua fitur bot hingga proses pembukaan blokir dilakukan melalui perintah *${prefix}unblock*._`
    );
  } catch (error) {
    console.error("Error handling command:", error);
    return await reply(
      m,
      `_Terjadi kesalahan saat memproses permintaan. Silakan coba lagi nanti._`
    );
  }
}

export default {
  handle,
  Commands: ["block"],
  OnlyPremium: false,
  OnlyOwner: true,
};
