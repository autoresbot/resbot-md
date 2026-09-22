import { findAbsen, updateAbsen, createAbsen, sudahAbsen } from "../../lib/absen.js";

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender, senderLid } = messageInfo;
  if (!isGroup) return; // Only Grub

  try {
    const data = await findAbsen(remoteJid);
    let textNotif;

    // Disimpan sebagai LID supaya sama dengan identitas peserta grup; kalau
    // LID tidak ada, nomor HP tetap dipakai seperti versi lama.
    const identitas = senderLid || sender;

    if (data) {
      // Jika sudah ada absen
      // Cek lewat NOMOR, bukan string mentah: absen lama tersimpan sebagai
      // nomor HP sedangkan sekarang LID — tanpa ini satu orang bisa absen
      // dua kali.
      if (sudahAbsen(data.member, sender, senderLid)) {
        textNotif = "⚠️ _Absen aja terus_ _Anda sudah absen hari ini!_";
      } else {
        // Tambahkan sender ke daftar member yang absen
        const updateData = {
          member: [...data.member, identitas],
        };
        await updateAbsen(remoteJid, updateData);
        textNotif = "✅ _Absen berhasil!_";
      }
    } else {
      // Pertama kali absen
      const insertData = {
        member: [identitas],
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
