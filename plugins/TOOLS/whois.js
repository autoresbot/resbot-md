import whois from "whois";
import { promisify } from "util";

import { reply } from "../../lib/utils.js";
import { logCustom } from "../../lib/logger.js";

const whoisLookup = promisify(whois.lookup);

function extractDomain(url) {
  try {
    // Menggunakan URL object untuk menghapus protokol
    const formattedUrl = url.startsWith("http") ? new URL(url).hostname : url;
    return formattedUrl.replace(/^www\./, ""); // Menghapus "www." jika ada
  } catch {
    return null; // Mengembalikan null jika bukan URL valid
  }
}

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, prefix, command, content } = messageInfo;

  try {
    // Validasi input
    if (!content) {
      return await reply(
        m,
        `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
          prefix + command
        } autoresbot.com*_`
      );
    }

    // Ekstrak domain
    const domain = extractDomain(content);
    if (!domain) {
      return await reply(
        m,
        `_Input tidak valid. Contoh: ${prefix}${command} autoresbot.com_`
      );
    }

    // Mengirim reaksi loading
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Memproses WHOIS lookup
    const data = await whoisLookup(domain);

    // Mengirim hasil
    await reply(m, data || "_Data WHOIS tidak ditemukan._");
  } catch (error) {
    console.error("Error in handle function:", error);
    logCustom("info", content, `ERROR-COMMAND-${command}.txt`);
    await sock.sendMessage(
      remoteJid,
      { text: `_Error: ${error.message}_` },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["whois"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
