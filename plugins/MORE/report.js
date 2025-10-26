import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";
import { reply } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { m, remoteJid, content, prefix, command } = messageInfo;

  try {
    // Validasi konten
    if (!content) {
      return await reply(
        m,
        `⚠️ _Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
          prefix + command
        }* error play music, Berikut linknya https://tiktok.com_`
      );
    }

    if (content.length < 30) {
      return await reply(m, `_⚠️ Minimal 30 Karakter_`);
    }

    // Persiapkan data
    const title = `Laporan Bug Resbot V${global.version}`;
    const api = new ApiAutoresbot(config.APIKEY);

    // Kirim laporan ke API
    const response = await api.get(`/api/database/report-issues`, {
      title,
      description: content,
    });

    if (response && response.status) {
      await sock.sendMessage(
        remoteJid,
        {
          text: "✅ Laporan berhasil dikirim. Terima kasih atas kontribusinya!",
        },
        { quoted: m }
      );
    } else {
      throw new Error("Tidak ada data dari API.");
    }
  } catch (error) {
    console.error("Error saat mengirim laporan:", error.message);
    await reply(m, `⚠️ ${error.message}`);
  }
}

export default {
  handle,
  Commands: ["report"],
  OnlyPremium: false,
  OnlyOwner: false,
};
