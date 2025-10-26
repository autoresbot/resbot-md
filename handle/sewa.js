const ONLY_GC_SEWA = false; // jika true maka grub tanpa sewa tidak akan di respon, jadikan false jika semua grub aktif

import { findSewa, deleteSewa } from "../lib/sewa.js";
import config from "../config.js";
import { selisihHari, danger, logTracking } from "../lib/utils.js";
import { logCustom } from "../lib/logger.js";
import { getGroupMetadata } from "../lib/cache.js";
import mess from "../strings.js";

const notificationDays = 3; // Jumlah hari sebelum notifikasi dikirim
const notifiedGroups = new Set(); // Cache untuk grup yang sudah menerima notifikasi
const nonSewaGroups = new Set();

async function leaveGroupWithRetry(sock, remoteJid, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logTracking(`Sewa Handler - keluar dari grub ${remoteJid}`);
      await sock.groupLeave(remoteJid);
      console.log(`Berhasil keluar dari grup pada percobaan ke-${attempt}`);
      break; // keluar dari loop jika berhasil
    } catch (err) {
      console.error(`Gagal keluar dari grup (percobaan ke-${attempt}):`, err);
      if (attempt === maxRetries) {
        console.error(`Gagal setelah ${maxRetries} kali mencoba.`);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // jeda 1 detik sebelum mencoba lagi
      }
    }
  }
}

async function process(sock, messageInfo) {
  const { remoteJid, isGroup, message } = messageInfo;

  if (!isGroup) {
    return true;
  }

  const dataSewa = await findSewa(remoteJid);

  if (dataSewa) {
    const now = Date.now(); // Timestamp sekarang dalam milidetik
    const notificationMs = notificationDays * 24 * 60 * 60 * 1000; // Notifikasi dalam milidetik
    const timeRemaining = dataSewa.expired - now; // Sisa waktu dalam milidetik

    const selisihHariSewa = selisihHari(dataSewa.expired);

    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    const participants = groupMetadata.participants;

    if (timeRemaining <= notificationMs && timeRemaining > 0) {
      if (!notifiedGroups.has(remoteJid)) {
        if (mess.handler.sewa_notif) {
          let warningMessage = mess.handler.sewa_notif.replace(
            "@date",
            selisihHariSewa
          );
          logTracking(`Sewa Handler - Send notif sewa ke ${remoteJid}`);
          await sock.sendMessage(
            remoteJid,
            { text: warningMessage, mentions: participants.map((p) => p.id) },
            { quoted: message }
          );
        }

        notifiedGroups.add(remoteJid); // Tandai grup sebagai sudah menerima notifikasi
        return false;
      }
    } else if (timeRemaining <= 0) {
      // Jika masa berlaku sudah habis

      if (mess.handler.sewa_out) {
        let warningMessage = mess.handler.sewa_out.replace(
          "@ownernumber",
          config.owner_number[0]
        );
        logTracking(`Sewa Handler - Send notif out sewa ke ${remoteJid}`);
        await sock.sendMessage(
          remoteJid,
          { text: warningMessage, mentions: participants.map((p) => p.id) },
          { quoted: message }
        );
      }

      // Delete database sewa
      await deleteSewa(remoteJid);

      try {
        await leaveGroupWithRetry(sock, remoteJid);
        danger("Sewa Habis", `Berhasil keluar Grub :  ${remoteJid}`);
      } catch (error) {
        console.error(`Gagal keluar dari grup ${remoteJid}:`, error);
        danger("Sewa Habis", `Gagal keluar grup : ${remoteJid}:`);
        logCustom(
          "info",
          "Gagal keluar grup",
          `gagal-keluar-grub-sewa-${remoteJid}.txt`
        );
      }
      return false;
    }
  } else {
    //Hanya log grup non-sewa satu kali
    if (!nonSewaGroups.has(remoteJid)) {
      logCustom(
        "info",
        "GRUB INI BUKAN TERMASUK SEWABOT",
        `bukan-sewa-${remoteJid}.txt`
      );
      //console.log(`${remoteJid} : GRUB INI BUKAN TERMASUK SEWABOT`)
      nonSewaGroups.add(remoteJid); // Tandai grup sebagai bukan sewa
    }
    if (ONLY_GC_SEWA) {
      return false;
    }
  }
}

export default {
  name: "Sewa Handle",
  priority: 10,
  process,
};
