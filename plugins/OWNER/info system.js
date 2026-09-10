import axios from "axios";
import { getServerSpecs } from "../../lib/startup.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, sender, command } = messageInfo;

  try {
    // Kirim reaksi ⏰ untuk menunjukkan sedang memproses
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Ambil spesifikasi server
    const {
      hostname,
      platform,
      architecture,
      totalMemory,
      freeMemory,
      uptime,
      mode,
    } = await getServerSpecs();

    // Ambil IP publik
    const response = await axios.get("https://api.ipify.org?format=json");
    const publicIp = response.data.ip;

    // Buat pesan informasi sistem
    const data = `◧ Hostname: ${hostname}
◧ Platform: ${platform}
◧ Architecture: ${architecture || "-"}
◧ Total Memory: ${totalMemory}
◧ Free Memory: ${freeMemory}
◧ Uptime: ${uptime}
◧ Public IP: ${publicIp}
◧ Mode: ${mode}`;

    // Kirim pesan informasi
    await sock.sendMessage(remoteJid, { text: data }, { quoted: message });
  } catch (error) {
    console.error("Error saat menangani perintah:", error.message);

    // Kirim pesan error ke pengguna
    await sock.sendMessage(
      remoteJid,
      { text: "❌ Terjadi kesalahan saat memproses permintaan." },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["infosistem", "infosystem"],
  OnlyPremium: false,
  OnlyOwner: true,
};
