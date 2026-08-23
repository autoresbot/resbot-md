import axios from "axios";
import dns from "dns";
import net from "net";
import { reply, isURL } from "../../lib/utils.js";

function isBlockedHost(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "metadata" ||
    host.endsWith(".internal")
  );
}

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }

  const low = address.toLowerCase();
  return (
    low === "::" ||
    low === "::1" ||
    low.startsWith("fc") ||
    low.startsWith("fd") ||
    low.startsWith("fe80") ||
    low.startsWith("::ffff:")
  );
}

async function assertPublicUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("URL tidak valid.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Hanya protokol http/https yang diizinkan.");
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");

  if (isBlockedHost(hostname)) {
    throw new Error("Akses ke alamat internal tidak diizinkan.");
  }

  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new Error("Akses ke alamat internal tidak diizinkan.");
    }
    return;
  }

  const resolved = await dns.promises.lookup(hostname, { all: true });
  if (resolved.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("Akses ke alamat internal tidak diizinkan.");
  }
}

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

    await assertPublicUrl(content);

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
