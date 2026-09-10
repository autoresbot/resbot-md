import axios from "axios";
import { reply, isURL } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, prefix, command, content } = messageInfo;
  const startTime = performance.now();

  try {
    // Validasi input
    if (!content || !isURL(content)) {
      return await reply(
        m,
        `_⚠️ Format Penggunaan:_ \n\n💬 _Contoh:_ _${
          prefix + command
        } https://autoresbot.com_`
      );
    }

    // Mengirim reaksi loading
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Memproses permintaan GET
    const response = await axios.get(content);
    const endTime = performance.now();
    const responseTime = (endTime - startTime).toFixed(2);

    // Cek tipe konten dari header respons
    const contentType = response.headers["content-type"] || "";
    if (contentType.includes("application/json")) {
      // Jika JSON, tampilkan isi JSON
      const jsonData = JSON.stringify(response.data, null, 2);
      const jsonResponse = `Website Info:
- Status: ${response.status}
- Response Time: ${responseTime} ms

JSON Data:
${jsonData}`;
      return await reply(m, jsonResponse);
    }

    // Jika bukan JSON, parsing HTML untuk mengambil title dan meta description
    const html = response.data;
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const metaMatch = html.match(
      /<meta\s+name="description"\s+content="(.*?)"/i
    );

    const title = titleMatch ? titleMatch[1] : "Tidak ditemukan";
    const metaDescription = metaMatch ? metaMatch[1] : "Tidak ditemukan";

    const infoGet = `Website Info:
- Title: ${title}
- Meta Description: ${metaDescription}
- Status: ${response.status}
- Response Time: ${responseTime} ms`;

    await reply(m, infoGet);
  } catch (error) {
    // Menangani kesalahan
    const errorMessage = `Maaf, terjadi kesalahan saat memproses permintaan Anda. Coba lagi nanti.\n\nDetail Kesalahan: ${error.message}`;
    await sock.sendMessage(
      remoteJid,
      { text: errorMessage },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["get"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
