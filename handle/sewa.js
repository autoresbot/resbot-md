const ONLY_GC_SEWA = false; // jika true maka grub tanpa sewa tidak akan di respon, jadikan false jika semua grub aktif

import { findSewa, deleteSewa, updateSewa } from "../lib/sewa.js";
import config from "../config.js";
import { selisihHari, danger, logTracking } from "../lib/utils.js";
import { logCustom } from "../lib/logger.js";
import { getGroupMetadata } from "../lib/cache.js";
import { createBoundedSet } from "../lib/boundedStore.js";
import { listOwner } from "../lib/users.js";
import mess from "../strings.js";

const notificationDays = 3; // Jumlah hari sebelum notifikasi dikirim

/**
 * Penanda "sedang/sudah diproses" di MEMORI.
 *
 * Fungsinya hanya mencegah balapan antar pesan yang masuk hampir bersamaan —
 * bukan sebagai sumber kebenaran. Yang menahan notifikasi lintas restart adalah
 * `notifiedExpired` yang disimpan di database (lihat di bawah).
 *
 * Dulu memakai Set biasa yang tidak pernah dibersihkan, jadi tiap grup baru
 * menambah entri permanen selama bot hidup.
 */
const notifiedGroups = createBoundedSet({ max: 5000, ttl: 24 * 60 * 60 * 1000 });
const expiredHandled = createBoundedSet({ max: 5000, ttl: 60 * 60 * 1000 });
const nonSewaGroups = createBoundedSet({ max: 5000, ttl: 6 * 60 * 60 * 1000 });

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

/**
 * Cari NOMOR HP owner yang bisa diklik (wa.me/628xx).
 *
 * DATA_OWNER umumnya berisi LID, dan wa.me/<lid> tidak bisa dibuka. Nomor baru
 * dipakai kalau memang terbukti nomor telepon:
 *   1. LID yang sudah dikenal bot -> diterjemahkan ke nomor aslinya
 *   2. entri bukan LID -> ditanyakan ke WhatsApp apakah nomornya terdaftar
 * Kalau tidak ada satu pun yang pasti, hasilnya null dan pemanggil menampilkan
 * petunjuk ".owner" sebagai gantinya.
 *
 * @returns {Promise<string|null>} digit nomor HP, atau null
 */
async function cariNomorOwner(sock) {
  for (const entri of listOwner() || []) {
    const digit = String(entri ?? "").replace(/[^0-9]/g, "");
    if (!digit) continue;

    try {
      const pn = await sock?.signalRepository?.lidMapping?.getPNForLID?.(
        `${digit}@lid`
      );
      if (pn) return pn.split("@")[0].split(":")[0];
    } catch {
      // lanjut ke pengecekan berikutnya
    }

    if (String(entri).endsWith("@lid")) continue;

    try {
      const hasil = await sock?.onWhatsApp?.(`${digit}@s.whatsapp.net`);
      if (Array.isArray(hasil) && hasil[0]?.exists === true) return digit;
    } catch {
      // tidak bisa dipastikan -> jangan tampilkan nomor yang mungkin salah
    }
  }
  return null;
}

/** Isi @ownernumber di teks sewa habis: nomor HP, atau petunjuk .owner. */
async function isiNomorOwner(sock, teks) {
  const nomor = await cariNomorOwner(sock);
  if (nomor) return teks.replace(/@ownernumber/g, nomor);

  const petunjuk = `Ketik *${config.prefix?.[0] ?? "."}owner* untuk melihat kontak owner`;
  return teks
    .replace(/(?:https?:\/\/)?wa\.me\/@ownernumber/gi, petunjuk)
    .replace(/@ownernumber/g, petunjuk);
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
    // FIX: participants validation - groupMetadata bisa null
    const participants = groupMetadata?.participants || [];

    if (timeRemaining <= notificationMs && timeRemaining > 0) {
      // Penanda PERSISTEN: disimpan di record sewa, jadi tetap berlaku setelah
      // bot restart. Nilainya adalah tanggal kedaluwarsa yang sudah dinotifikasi
      // — kalau owner memperpanjang sewa, `expired` berubah dan grup berhak
      // dapat peringatan lagi untuk periode baru itu.
      const sudahDinotifikasi = dataSewa.notifiedExpired === dataSewa.expired;

      if (!sudahDinotifikasi && !notifiedGroups.has(remoteJid)) {
        // Klaim slot SEBELUM `await` apa pun.
        //
        // Ini inti perbaikan spam: dulu penandanya dipasang SETELAH
        // `sendMessage` selesai, sehingga beberapa pesan yang masuk hampir
        // bersamaan sama-sama lolos pengecekan `has()` dan masing-masing ikut
        // mengirim peringatan. Makin cepat servernya, makin banyak yang lolos.
        notifiedGroups.add(remoteJid);

        try {
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

          await updateSewa(remoteJid, { notifiedExpired: dataSewa.expired });
        } catch (error) {
          // Gagal kirim -> lepaskan klaim supaya bisa dicoba lagi nanti,
          // daripada grup tidak pernah diperingatkan sama sekali.
          notifiedGroups.delete(remoteJid);
          console.error(`Gagal kirim notif sewa ke ${remoteJid}:`, error);
        }

        return false;
      }
    } else if (timeRemaining <= 0) {
      // Pengaman yang sama untuk jalur "sewa habis": tanpa ini, beberapa pesan
      // yang masuk bersamaan bisa sama-sama mengirim pesan keluar + memanggil
      // groupLeave berkali-kali.
      if (expiredHandled.has(remoteJid)) return false;
      expiredHandled.add(remoteJid);

      // Jika masa berlaku sudah habis

      if (mess.handler.sewa_out) {
        let warningMessage = await isiNomorOwner(sock, mess.handler.sewa_out);
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
