import { setGroupSchedule } from "../../lib/participants.js";
import { getGroupMetadata } from "../../lib/cache.js";
import moment from "moment-timezone";
import mess from "../../strings.js";
import { convertTime, getTimeRemaining } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, content, sender, command, prefix } =
    messageInfo;
  if (!isGroup) return; // Hanya untuk grup

  // Mendapatkan metadata grup
  const groupMetadata = await getGroupMetadata(sock, remoteJid);
  const participants = groupMetadata.participants;
  const isAdmin = participants.some(
    (p) => (p.phoneNumber === sender || p.id === sender) && p.admin
  );
  if (!isAdmin) {
    await sock.sendMessage(
      remoteJid,
      { text: mess.general.isAdmin },
      { quoted: message }
    );
    return;
  }

  const currentTime = moment().tz("Asia/Jakarta").format("HH:mm");

  // Validasi input kosong
  if (!content || !content.trim()) {
    const MSG = `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
      prefix + command
    } 23:10*_
        
_Bot akan menutup grup secara otomatis pada jam itu setiap harinya_ \n\n_Untuk menghapus silakan ketik *.setclosegc off*_`;
    return await sock.sendMessage(
      remoteJid,
      { text: MSG },
      { quoted: message }
    );
  }

  if (content.trim() == "off") {
    // delete
    await setGroupSchedule(sock, remoteJid, content.trim(), "closeTime");
    return await sock.sendMessage(
      remoteJid,
      { text: `_✅ Close Grub otomatis berhasil di hapus_` },
      { quoted: message }
    );
    return;
  }

  // Validasi format jam
  const timeRegex = /^([01]?\d|2[0-3]):[0-5]\d$/; // Format HH:mm
  if (!timeRegex.test(content.trim())) {
    const MSG = `_⚠️ Format jam tidak valid!_\n\n_Pastikan format jam adalah HH:mm (contoh: 23:10)_`;
    return await sock.sendMessage(
      remoteJid,
      { text: MSG },
      { quoted: message }
    );
  }

  // Lanjutkan proses penyimpanan jadwal
  await setGroupSchedule(sock, remoteJid, content.trim(), "closeTime");

  const serverTime = convertTime(content.trim());
  const { hours, minutes } = getTimeRemaining(serverTime);

  // Kirim pesan berhasil
  return await sock.sendMessage(
    remoteJid,
    {
      text: `✅ _Berhasil, Grup otomatis ditutup pada jam *${content.trim()}* WIB_ \n⏰ _Sekitar ${hours} jam ${minutes} menit lagi_\n\n_Pastikan bot sudah admin untuk menggunakan fitur ini_`,
    },
    { quoted: message }
  );
}

export default {
  handle,
  Commands: ["setclosegc"],
  OnlyPremium: false,
  OnlyOwner: false,
};
