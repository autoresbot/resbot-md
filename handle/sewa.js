const ONLY_GC_SEWA = false; // jika true maka grub tanpa sewa tidak akan di respon, jadikan false jika semua grub aktif

import { findSewa } from "../lib/sewa.js";
import { logCustom } from "../lib/logger.js";
import { createBoundedSet } from "../lib/boundedStore.js";
import { prosesSewaHabis, kirimPeringatanSewa, statusSewa } from "../lib/sewaCek.js";

/**
 * Handler sewa per pesan masuk.
 *
 * Logika sewa (peringatan & keluar grup) ada di lib/sewaCek.js dan dipakai
 * bersama pengecek berkala — jadi bot tetap keluar dari grup yang sewanya
 * habis walau tidak ada yang chat di sana.
 */

const nonSewaGroups = createBoundedSet({ max: 5000, ttl: 6 * 60 * 60 * 1000 });

async function process(sock, messageInfo) {
  const { remoteJid, isGroup, message } = messageInfo;

  if (!isGroup) {
    return true;
  }

  const dataSewa = await findSewa(remoteJid);

  if (dataSewa) {
    const status = statusSewa(dataSewa);

    if (status === "segera") {
      // Peringatan dikirim sekali per periode sewa; pesan yang memicunya
      // tidak diproses lebih lanjut (perilaku lama).
      if (await kirimPeringatanSewa(sock, remoteJid, dataSewa, message)) return false;
    } else if (status === "habis") {
      // Sewa habis: grup tidak dilayani lagi, apa pun hasil keluarnya.
      await prosesSewaHabis(sock, remoteJid, dataSewa, message);
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
