import config from "../../config.js";

import {
  createUser,
  createServer,
  deleteServer,
  panelReady,
  deleteUser,
} from "../../lib/panel.js";
import { reply, random, logWithTime } from "../../lib/utils.js";
import axios from "axios";

async function checkDomainAccessibility(url) {
  try {
    const response = await axios.get(url, { timeout: 5000 }); // Timeout 5 detik
    return response.status >= 200 && response.status < 300; // Status sukses HTTP
  } catch (error) {
    return false; // Jika error, anggap domain tidak bisa diakses
  }
}

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, prefix, command } = messageInfo;

  try {
    // Periksa apakah panel siap
    if (!panelReady()) {
      const warningMessage = `
⚠️ _Konfigurasi panel belum selesai._

_Silakan lengkapi bagian:_ *PANEL_URL*, *PANEL_PLTA*, dan *PANEL_ID_EGG* _di file *config.js*._

_Pastikan Anda adalah pemilik *server panel* atau *admin panel* untuk mendapatkan informasi tersebut._`;
      return await reply(m, warningMessage.trim());
    }

    // Periksa aksesibilitas domain
    const panelURL = config.PANEL.URL;
    const isDomainAccessible = await checkDomainAccessibility(panelURL);
    if (!isDomainAccessible) {
      const inaccessibleMessage = `❌ _Panel tidak dapat diakses._ \n\n_Pastikan domain ${panelURL} aktif dan dapat dijangkau._`;
      return await reply(m, inaccessibleMessage);
    }

    // Indikator proses sedang berjalan
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Generate data user testing
    const email = `testingpanel${random(4)}@gmail.com`;
    const username = `testingpanel${random(4)}`;
    const password = random();

    // Buat user testing
    const userResult = await createUser(email, username, password);
    if (!userResult) throw new Error("Gagal membuat user testing.");
    const userId = userResult.attributes.id;

    // Tentukan resources server
    const resources = {
      memory: 1024,
      swap: 0,
      disk: config.PANEL.default_disk || 10240,
      io: 500,
      cpu: config.PANEL.cpu_default || 200,
    };

    // Buat server untuk user
    const serverName = username;
    const serverResult = await createServer(serverName, userId, resources);
    if (!serverResult) {
      await deleteUser(userId); // Hapus user jika server gagal dibuat
      throw new Error("Gagal membuat server untuk user testing.");
    }

    logWithTime("PANEL", `Berhasil membuat server`);
    const serverId = serverResult.attributes.id;

    // Hapus server dan user
    await deleteServer(serverId);
    logWithTime("PANEL", `Berhasil delete server - ${serverId}`);

    await deleteUser(userId);
    logWithTime("PANEL", `Berhasil delete users - ${userId}`);

    const successMessage = `✅ _Status Panel : Terhubung_`;
    return await reply(m, successMessage);
  } catch (error) {
    // Default header untuk pesan error
    const errorHeader = "❌ Terjadi kesalahan:\n";

    // Cek apakah ada properti `errors` dalam objek error
    let errorDetails = "Tidak ada detail error.";
    if (error.errors && Array.isArray(error.errors)) {
      // Jika ada, gabungkan detail error menjadi string
      errorDetails = error.errors
        .map(
          (err) =>
            `- ${err.detail || "Detail tidak tersedia."} (${
              err.code || "Kode tidak tersedia."
            })`
        )
        .join("\n");
    } else if (error.message) {
      // Jika tidak ada, gunakan pesan error umum
      errorDetails = error.message;
    }

    // Format pesan error
    const errorMessage = `${errorHeader}\n${errorDetails}`;

    // Kirim pesan error ke pengguna
    await sock.sendMessage(
      remoteJid,
      { text: errorMessage },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["statuspanel"],
  OnlyPremium: false,
  OnlyOwner: true,
};
