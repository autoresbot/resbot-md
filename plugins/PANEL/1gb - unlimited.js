import config from "../../config.js";
import {
  createUser,
  createServer,
  findUserByEmail,
  panelReady,
  saveUser,
  saveServer,
} from "../../lib/panel.js";
import { reply, getCurrentDate, random } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, content, prefix, command } = messageInfo;
  const date = getCurrentDate();
  const passwordRandom = random(5);
  let memory = 0;

  if (command === "unlimited") {
    memory = 0;
  } else if (command.endsWith("gb")) {
    memory = parseFloat(command) * 1024 || 0;
  } else {
    memory = parseFloat(command) || 0;
  }

  try {
    const isConfigReady = await panelReady();

    // Periksa apakah panel siap digunakan
    if (!isConfigReady) {
      return await reply(
        m,
        "⚠️ _Konfigurasi panel belum selesai._\n\n_Silakan lengkapi bagian :_ *PANEL_URL*, *PANEL_PLTA*, dan *PANEL_ID_EGG* _di file *config.js*_.\n\n_Pastikan Anda adalah pemilik *server panel* atau *admin panel* untuk mendapatkan informasi tersebut._"
      );
    }

    // Validasi input
    if (!content) {
      return await reply(
        m,
        `⚠️ _Format Penggunaan_\n\n_Contoh ${
          prefix + command
        } azhari,6285246154386_`
      );
    }

    // Pisahkan nama dan nomor WA dari input pengguna
    let [nama, nowa] = content.split(",");
    if (!nama || !nowa) {
      return await reply(
        m,
        `⚠️ _Format salah! Pastikan menggunakan format: ${
          prefix + command
        } nama,nomor_`
      );
    }

    const email = `${nama.trim()}@gmail.com`;

    // Indikator proses sedang berjalan
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Inisialisasi data pengguna dan server
    let user = await findUserByEmail(email);
    let id, username, newPassword;
    if (!user) {
      // Buat pengguna baru jika tidak ditemukan
      const result = await createUser(email, nama, passwordRandom);
      if (!result) throw new Error("Gagal membuat pengguna baru.");

      // Simpan data pengguna baru
      await saveUser();
      id = result.attributes.id;
      username = result.attributes.username;
      newPassword = passwordRandom;
    } else {
      id = user.attributes.id;
      username = user.attributes.username;
    }

    // Konfigurasi server
    const serverName = `${username} - ${date}`;
    const resources = {
      memory,
      swap: 0,
      disk: config.PANEL.default_disk,
      io: 500,
      cpu: config.PANEL.cpu_default,
    };

    // Buat server baru
    const server = await createServer(serverName, id, resources);
    if (!server) throw new Error("Gagal membuat server.");

    // Simpan data server baru
    await saveServer();

    // Kirim informasi server ke pengguna melalui WhatsApp
    if (nowa) {
      nowa = nowa.trim();
      const remoteJidUser = nowa.endsWith("@s.whatsapp.net")
        ? nowa
        : `${nowa}@s.whatsapp.net`;

      const msgResult = `📋 *_Berikut Info Panel Kamu_*\n\n
🔑 _*ID:*_ ${server.attributes.id}
🛠️ _*UUID:*_ ${server.attributes.uuid}
👤 _*Nama:*_ ${server.attributes.name}
🔧 _*Status:*_ ${server.attributes.status}

*Data Login*
📧 _*Email :*_ ${email}
🔒 _*Password :*_ ${newPassword || ""}

🌐 _*Alternatif Link:*_ ${config.PANEL.URL}/server/${
        server.attributes.identifier
      }`;

      await sock.sendMessage(remoteJidUser, { text: msgResult });
    }

    // Kirim notifikasi keberhasilan
    const messageText = "✅ _Server Panel berhasil dibuat_";
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
    const errorMessage = `${header}${errorDetails}`;

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
  Commands: [
    "1gb",
    "2gb",
    "3gb",
    "4gb",
    "5gb",
    "6gb",
    "7gb",
    "8gb",
    "unlimited",
  ],
  OnlyPremium: false,
  OnlyOwner: true,
};
