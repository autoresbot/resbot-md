import { findAbsen, updateAbsen, createAbsen } from "../../lib/absen.js";

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender } = messageInfo;
  if (!isGroup) return; // Only Grub

  try {
    const data = await findAbsen(remoteJid);
    let textNotif;

    if (data) {
      // Jika sudah ada absen
      // Cek apakah sender sudah absen
      if (data.member.includes(sender)) {
        textNotif = "⚠️ _Absen aja terus_ _Anda sudah absen hari ini!_";
      } else {
        // Tambahkan sender ke daftar member yang absen
        const updateData = {
          member: [...data.member, sender],
        };
        await updateAbsen(remoteJid, updateData);
        textNotif = "✅ _Absen berhasil!_";
      }
    } else {
      // Pertama kali absen
      const insertData = {
        member: [sender],
      };
      await createAbsen(remoteJid, insertData);
      textNotif = "✅ _Absen berhasil!_";
    }

    // Kirim pesan ke pengguna
    return await sock.sendMessage(
      remoteJid,
      { text: textNotif },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error handling absen:", error);
    // Kirim pesan error ke pengguna jika ada kesalahan
    return await sock.sendMessage(
      remoteJid,
      { text: "Terjadi kesalahan saat memproses absen." },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["absen"],
  OnlyPremium: false,
  OnlyOwner: false,
};
