import config from "../../config.js";
import {
  createServer,
  findUserByEmail,
  panelReady,
  saveServer,
} from "../../lib/panel.js";
import { reply } from "../../lib/utils.js";

/**
 * Validasi email
 * @param {string} email
 * @returns {string|null} Pesan error atau null jika valid
 */
function validateEmail(email) {
  if (!email)
    return "_Format: *.createserver email ram cpu nowa(opsional)*_ \n\nContoh : _*.createserver xxx@gmail.com 2 unlimited 6285246154386*_";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email)
    ? null
    : "_Format email tidak valid. Contoh: xxx@gmail.com_";
}

/**
 * Validasi sumber daya (RAM atau CPU)
 * @param {string} value
 * @param {string} name
 * @returns {string|null} Pesan error atau null jika valid
 */
function validateResource(value, name) {
  if (!value || (isNaN(value) && value.toLowerCase() !== "unlimited")) {
    return `_Masukkan nilai ${name} adalah angka positif atau 'unlimited'_`;
  }
  if (!isNaN(value) && parseFloat(value) <= 0) {
    return `_Masukkan nilai ${name} adalah angka positif atau 'unlimited'_`;
  }
  return null;
}

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, content, prefix, command } = messageInfo;

  try {
    // Periksa apakah panel siap digunakan
    const isConfigReady = await panelReady();
    if (!isConfigReady) {
      await sock.sendMessage(
        remoteJid,
        {
          text: "⚠️ _Konfigurasi panel belum selesai._\n\n_Silakan lengkapi bagian :_ *PANEL_URL*, *PANEL_PLTA*, dan *PANEL_ID_EGG* _di file *config.js*_.\n\n_Pastikan Anda adalah pemilik *server panel* atau *admin panel* untuk mendapatkan informasi tersebut._",
        },
        { quoted: message }
      );

      return;
    }

    const [email, ram, cpu, nowa] = content.split(" ");

    // Validasi email
    const emailError = validateEmail(email);
    if (emailError) {
      await sock.sendMessage(
        remoteJid,
        {
          text: emailError,
        },
        { quoted: message }
      );
      return;
    }

    // Validasi RAM dan CPU
    const ramError = validateResource(ram, "RAM");
    if (ramError) {
      await sock.sendMessage(
        remoteJid,
        { text: ramError },
        { quoted: message }
      );
      return;
    }

    const cpuError = validateResource(cpu, "CPU");
    if (cpuError) {
      await sock.sendMessage(
        remoteJid,
        { text: cpuError },
        { quoted: message }
      );
      return;
    }

    // Indikator proses sedang berjalan
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Ambil data pengguna berdasarkan email
    const user = await findUserByEmail(email);
    if (!user) {
      return await reply(
        m,
        `⚠️ _Pengguna dengan email ${email} tidak ditemukan_

_Buat Pengguna dengan mengetik *.createuser*_`
      );
    }

    const { id, username, root_admin } = user.attributes;

    const serverName = `${username} - ${ram}`;
    const memory = isNaN(ram) ? 0 : 1024 * parseFloat(ram);

    const resources = {
      memory,
      swap: 0,
      disk: config.PANEL.default_disk,
      io: 500,
      cpu: config.PANEL.cpu_default,
    };

    // Buat server
    const server = await createServer(serverName, id, resources);

    if (server) {
      await saveServer();
    }

    if (nowa) {
      // Tambahkan '@s.whatsapp.net' jika belum ada
      const remoteJid_User = nowa.endsWith("@s.whatsapp.net")
        ? nowa
        : nowa + "@s.whatsapp.net";
      const sendToUser = `📋 _Berikut Info Panel Kamu_
        
☍ _*ID:*_ ${server.attributes.id}
☍ _*Name:*_ ${server.attributes.name}
☍ _*Status:*_ ${server.attributes.status}

☍ _*Link:*_ ${config.PANEL.URL}/server/${server.attributes.identifier}`;

      await sock.sendMessage(remoteJid_User, { text: sendToUser });
    }

    const messageText = server
      ? "✅ _Server Panel berhasil dibuat_\n"
      : "❌ _Gagal Membuat Server_";
    await sock.sendMessage(
      remoteJid,
      { text: messageText },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error in handle function:", error);

    // Format pesan error
    const header = "❌ Terjadi kesalahan:\n";
    const errorDetails =
      error.errors?.map((err) => `- ${err.detail}`).join("\n") ||
      error.message ||
      "Tidak ada detail error.";

    // Gabungkan header, detail, dan footer
    const errorMessage = `${header}\n${errorDetails}`;

    // Kirim pesan ke pengguna
    await sock.sendMessage(
      remoteJid,
      { text: errorMessage },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["createserver"],
  OnlyPremium: false,
  OnlyOwner: true,
};
