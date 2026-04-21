import qrcode from "qrcode";

import mess from "../../strings.js";
import { reply } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, prefix, command, content } = messageInfo;

  // Validasi input
  if (!content) {
    return await reply(
      m,
      `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${prefix + command} resbot*_`
    );
  }

  try {
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const resultQr = await qrcode.toDataURL(content, { scale: 8 });
    const buffer = new Buffer.from(
      resultQr.replace("data:image/png;base64,", ""),
      "base64"
    );

    // Kirim pesan dengan tangkapan layar
    await sock.sendMessage(
      remoteJid,
      {
        image: buffer,
        caption: mess.general.success,
      },
      { quoted: message }
    );
  } catch (error) {
    console.error("Kesalahan dalam fungsi handle:", error);

    const errorMessage = error.message || "Terjadi kesalahan tak dikenal.";
    return await sock.sendMessage(
      remoteJid,
      { text: `_Error: ${errorMessage}_` },
      { quoted: message }
    );
  }
}
export default {
  handle,
  Commands: ["createqr"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
