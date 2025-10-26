import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";
import { logCustom } from "../../lib/logger.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, prefix, command, content } = messageInfo;

  try {
    // Validasi jika `content` kosong
    if (!content) {
      const usageMessage = `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
        prefix + command
      } sambas*_`;
      await sock.sendMessage(
        remoteJid,
        { text: usageMessage },
        { quoted: message }
      );
      return;
    }

    // Mengirim reaksi loading
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const api = new ApiAutoresbot(config.APIKEY);

    // Memanggil API jadwal sholat
    const response = await api.get("/api/jadwalsholat", { kota: content });

    // Validasi respons
    const prayerSchedule = response?.data?.jadwal;
    if (prayerSchedule) {
      const formattedSchedule =
        `_Jadwal Sholat Area *${content.toUpperCase()}*_\n\n` +
        `_${prayerSchedule.tanggal}_\n\n` +
        `◧ [ ${prayerSchedule.imsak} ] Imsak\n` +
        `◧ [ ${prayerSchedule.subuh} ] *Subuh*\n` +
        `◧ [ ${prayerSchedule.dhuha} ] Dhuha\n` +
        `◧ [ ${prayerSchedule.dzuhur} ] *Dzuhur*\n` +
        `◧ [ ${prayerSchedule.ashar} ] *Ashar*\n` +
        `◧ [ ${prayerSchedule.maghrib} ] *Maghrib*\n` +
        `◧ [ ${prayerSchedule.isya} ] *Isya*`;

      // Mengirim data jadwal sholat ke pengguna
      await sock.sendMessage(
        remoteJid,
        { text: formattedSchedule },
        { quoted: message }
      );
    } else {
      logCustom("info", content, `ERROR-COMMAND-${command}.txt`);
      // Pesan jika data kosong
      const noDataMessage = `⚠️ _Tidak ada hasil untuk kota *${content}*._`;
      await sock.sendMessage(
        remoteJid,
        { text: noDataMessage },
        { quoted: message }
      );
    }
  } catch (error) {
    logCustom("info", content, `ERROR-COMMAND-${command}.txt`);
    // Pesan kesalahan kepada pengguna
    const errorMessage =
      `Maaf, terjadi kesalahan saat memproses permintaan Anda.\n\n` +
      `Detail Kesalahan: ${error.message}`;
    await sock.sendMessage(
      remoteJid,
      { text: errorMessage },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["jadwalsholat", "jadwalshalat"],
  OnlyPremium: false,
  OnlyOwner: false,
};
