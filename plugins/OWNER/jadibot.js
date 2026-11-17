import fs from "fs";
import path from "path";

import "../../lib/zapo/websocket-polyfill.js";
import { WaClient } from "zapo-js";
import { createSessionStore } from "../../lib/zapo/store.js";
import { migrateSessionIfNeeded } from "../../lib/zapo/migrate.js";
import { createBaileysCompatSocket } from "../../lib/zapo/socket.js";

import qrcode from "qrcode-terminal";
import pino from "pino";
const logger = pino({ level: "silent" });
import { connectToWhatsApp } from "../../lib/connection.js";
import { updateJadibot } from "../../lib/jadibot.js";

import {
  logWithTime,
  success,
  danger,
  deleteFolderRecursive,
} from "../../lib/utils.js";
import { sessions } from "../../lib/cache.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SESSION_PATH = "./session/";

async function startNewSession(masterSessions, senderId, type_connection, durasiHari = 0) {
  const infoDurasi = durasiHari > 0 ? ` _(aktif ${durasiHari} hari)_` : "";
  logWithTime("System", `Menjalankan startNewSession`, "merah");
  const sessionFolder = path.join(SESSION_PATH, senderId);

  if (!fs.existsSync(sessionFolder)) {
    await fs.promises.mkdir(sessionFolder, { recursive: true });
  }

  await migrateSessionIfNeeded(sessionFolder, (msg) =>
    logWithTime("Migrasi", msg)
  );

  const sessionStore = createSessionStore(sessionFolder);

  const client = new WaClient(
    {
      store: sessionStore,
      sessionId: "default",
      auth: { deviceBrowser: "chrome", deviceOsDisplayName: "Ubuntu" },
      history: { enabled: false }, // lihat lib/connection.js
    },
    logger
  );

  const sock = createBaileysCompatSocket(client, {
    storeSession: sessionStore.session("default"),
  });

  // Kode pairing zapo diminta saat connect() berjalan, bukan sebelumnya.
  // Pemicunya `auth_qr` yang PERTAMA — bukan `auth_pairing_required`, karena
  // event itu baru muncul saat server me-refresh sesi pairing yang SUDAH ada.
  // Lihat penjelasan lengkap di lib/connection.js.
  if (type_connection == "pairing") {
    let pairingRequested = false;

    const mintaKodePairing = async () => {
      if (pairingRequested) return;
      pairingRequested = true;

      try {
        const code = await client.auth.requestPairingCode(senderId.trim());
        logWithTime("System", `Pairing Code : ${code}`);
        const textResponse = `⏳ _Jadibot ${senderId}_${infoDurasi}\n
_Code Pairing :_ ${code}`;
        await masterSessions.sock.sendMessage(
          masterSessions.remoteJid,
          { text: textResponse },
          { quoted: masterSessions.message }
        );
      } catch (error) {
        pairingRequested = false;
        danger("Jadibot", `Gagal meminta kode pairing: ${error?.message || error}`);
      }
    };

    client.on("auth_qr", mintaKodePairing);

    client.on("auth_pairing_required", ({ forceManual } = {}) => {
      if (!forceManual) return;
      pairingRequested = false;
      mintaKodePairing();
    });
  }

  // Tidak ada `creds.update` di zapo — store menyimpan kredensial otomatis.

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && type_connection === "qr") {
      logWithTime("System", `Menampilkan QR`);
      await masterSessions.sock.sendMessage(
        masterSessions.remoteJid,
        { text: "Menampilkan QR" },
        { quoted: masterSessions.message }
      );

      qrcode.generate(qr, { small: true }, (qrcodeStr) =>
        console.log(qrcodeStr)
      );
    }

    if (connection === "close") {
      // zapo memakai alasan berupa string, bukan status code numerik.
      const reason = lastDisconnect?.error?.output?.statusCode || "Unknown";
      const reasonMessages = {
        failure_not_authorized: "Bad Session File, Start Again ...",
        client_disconnected: "Connection closed, reconnecting...",
        comms_stopped: "Connection Lost from Server, reconnecting...",
        stream_error_replaced:
          "Connection Replaced, Another New Session Opened",
        stream_error_device_removed:
          "Perangkat Terkeluar, Silakan Scan/Pairing Ulang",
        stream_error_force_logout:
          "Perangkat Terkeluar, Silakan Scan/Pairing Ulang",
        stream_error_ack: "Restart Required, Restarting...",
        failure_service_unavailable: "Connection TimedOut, Reconnecting...",
      };

      const message =
        reasonMessages[reason] || `Unknown DisconnectReason: ${reason}`;

      if (update.isLogout) {
        const sessionPath = path.join(SESSION_PATH, senderId);
        const sessionExists = fs.existsSync(sessionPath);
        if (sessionExists) {
          deleteFolderRecursive(sessionPath);
          await masterSessions.sock.sendMessage(
            masterSessions.remoteJid,
            { text: `✅ _Perangkat Terkeluar, Silakan Ketik ulang .jadibot_` },
            { quoted: masterSessions.message }
          );
        }
      }
      if (reason === "stream_error_ack") {
        logWithTime("System", message);
        if (sock) {
          await sock.ws.close(); // Tutup WebSocket
        }

        await connectToWhatsApp(`session/${senderId}`);
      } else if (reason === "failure_service_unavailable") {
        await updateJadibot(senderId, "inactive");
        await masterSessions.sock.sendMessage(
          masterSessions.remoteJid,
          {
            text: `⚠️ _Ada masalah saat terhubung ke socket_\n\n_Silakan Ketik *.stopjadibot* untuk berhenti lalu mencoba lagi_`,
          },
          { quoted: masterSessions.message }
        );
        return;
      } else {
        danger("Jadibot", message);
      }
    }

    if (connection === "open") {
      success("System", "JADIBOT TERHUBUNG");
      await updateJadibot(senderId, "active");
      await masterSessions.sock.sendMessage(
        masterSessions.remoteJid,
        { text: `✅ _Berhasil! Nomor *${senderId}* telah menjadi bot._${infoDurasi}` },
        { quoted: masterSessions.message }
      );
      if (sock) {
        await sock.ws.close(); // Tutup WebSocket
        await connectToWhatsApp(`session/${senderId}`);
      }
    }
  });

  // zapo butuh connect() eksplisit (Baileys menyambung otomatis saat dibuat).
  client.connect().catch((error) => {
    danger("Jadibot", `Connect gagal: ${error?.message || error}`);
  });

  return sock;
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, sender, prefix, command, content } = messageInfo;

  // Validasi input: Konten harus ada
  if (!content) {
    await sock.sendMessage(
      remoteJid,
      {
        text: `_⚠️ Format Penggunaan:_\n\n_💬 Contoh:_\n_*${
          prefix + command
        } 6285246154386*_ _(aktif selamanya)_\n_*${
          prefix + command
        } 6285246154386 7*_ _(aktif 7 hari)_\n\n_Ketik *${prefix}stopjadibot* untuk berhenti_`,
      },
      { quoted: message }
    );
    return;
  }

  // Format: "<nomor> [durasi_hari]". Nomor & durasi dipisah spasi, jadi tidak
  // boleh digabung mentah (dulu `replace(/\D/g,"")` menempelkan angka durasi ke
  // belakang nomor sehingga "628.. 7" jadi nomor tidak valid).
  const bagian = content.trim().split(/\s+/);
  let targetNumber = (bagian[0] || "").replace(/\D/g, ""); // Hanya angka

  // Durasi (hari) opsional pada argumen kedua.
  let durasiHari = 0;
  if (bagian[1] !== undefined) {
    durasiHari = parseInt(bagian[1].replace(/\D/g, ""), 10);
    if (!Number.isFinite(durasiHari) || durasiHari <= 0) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ _Durasi (hari) tidak valid._\n\n_💬 Contoh:_ _*${
            prefix + command
          } ${targetNumber || "6285246154386"} 7*_`,
        },
        { quoted: message }
      );
      return;
    }
  }

  const expiredAt = durasiHari > 0 ? Date.now() + durasiHari * 24 * 60 * 60 * 1000 : null;

  // Validasi panjang nomor telepon
  if (targetNumber.length < 10 || targetNumber.length > 15) {
    await sock.sendMessage(
      remoteJid,
      { text: `⚠️ Nomor tidak valid.` },
      { quoted: message }
    );
    return;
  }

  // Tambahkan domain jika belum ada
  if (!targetNumber.endsWith("@s.whatsapp.net")) {
    targetNumber += "@s.whatsapp.net";
  }

  // Validasi apakah nomor ada di WhatsApp
  const result = await sock.onWhatsApp(targetNumber);
  if (!result || result.length === 0 || !result[0].exists) {
    await sock.sendMessage(
      remoteJid,
      { text: `⚠️ Nomor tidak terdaftar di WhatsApp.` },
      { quoted: message }
    );
    return;
  }

  const type_connection = "pairing";

  try {
    // Tampilkan reaksi "loading"
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Pastikan folder sesi ada
    const senderId = targetNumber.replace("@s.whatsapp.net", "");
    const sessionPath = path.join(SESSION_PATH, senderId);

    // Mulai sesi baru — sekaligus simpan kedaluwarsa (null = selamanya).
    await updateJadibot(senderId, "inactive", expiredAt);

    // Hapus sesi aktif
    const sockSesi = sessions.get(`session/${senderId}`);
    if (sockSesi) {
      await updateJadibot(senderId, "stop");
      await sockSesi.ws.close(); // Tutup WebSocket
      sessions.delete(`session/${senderId}`); // Hapus dari daftar sesi
    }

    if (fs.existsSync(sessionPath)) {
      logWithTime(`Reload Session for ${senderId}`, message);
      await startNewSession(
        { sock, remoteJid, message },
        senderId,
        type_connection,
        durasiHari
      );
      return;
    } else {
      await startNewSession(
        { sock, remoteJid, message },
        senderId,
        type_connection,
        durasiHari
      );
    }
  } catch (error) {
    console.error("Terjadi kesalahan:", error);
    await sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ Terjadi kesalahan saat memproses perintah. Silakan coba lagi.`,
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["jadibot"],
  OnlyPremium: false,
  OnlyOwner: true,
};
