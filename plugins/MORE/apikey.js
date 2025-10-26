import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";
import { reply } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, prefix, command, content } = messageInfo;

  try {
    // Mengirim reaksi loading
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });
    const api = new ApiAutoresbot(config.APIKEY);

    // Memanggil API berdasarkan konten
    const response = await api.get("/check_apikey");
    if (response && response.limit_key) {
      const tanggalAktif = new Date(response.limit_key * 1000);
      const bulan = [
        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember",
      ];
      const formattedDate = `${tanggalAktif.getDate()} ${
        bulan[tanggalAktif.getMonth()]
      } ${tanggalAktif.getFullYear()}`;
      await reply(
        m,
        `✅ _Apikey Aktif_

◧ _Masa Aktif Hingga :_ *${formattedDate}*
◧ _Limit :_ *${response.limit_apikey}*`
      );
    } else {
      await reply(m, `⛔ _Apikey Tidak Terdaftar / Expired_`);
    }
  } catch (error) {
    await sock.sendMessage(
      remoteJid,
      { text: error.message },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["apikey"],
  OnlyPremium: false,
  OnlyOwner: false,
};
