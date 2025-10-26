import fs from "fs";
import path from "path";

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "baileys";

import { Boom } from "@hapi/boom";
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

async function startNewSession(masterSessions, senderId, type_connection) {
  logWithTime("System", `Menjalankan startNewSession`, "merah");
  const sessionFolder = path.join(SESSION_PATH, senderId);

  if (!fs.existsSync(sessionFolder)) {
    await fs.promises.mkdir(sessionFolder, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: logger,
    printQRInTerminal: false,
    auth: state,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
  });

  if (!sock.authState.creds.registered && type_connection == "pairing") {
    const phoneNumber = senderId;
    await delay(4000);
    const code = await sock.requestPairingCode(phoneNumber.trim());
    logWithTime("System", `Pairing Code : ${code}`);
    const textResponse = `⏳ _Jadibot ${senderId}_\n
_Code Pairing :_ ${code}`;
    await masterSessions.sock.sendMessage(
      masterSessions.remoteJid,
      { text: textResponse },
      { quoted: masterSessions.message }
    );
  }

  sock.ev.on("creds.update", saveCreds);

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
      const reason =
        new Boom(lastDisconnect?.error)?.output?.statusCode || "Unknown";
      const reasonMessages = {
        [DisconnectReason.badSession]: "Bad Session File, Start Again ...",
        [DisconnectReason.connectionClosed]:
          "Connection closed, reconnecting...",
        [DisconnectReason.connectionLost]:
          "Connection Lost from Server, reconnecting...",
        [DisconnectReason.connectionReplaced]:
          "Connection Replaced, Another New Session Opened",
        [DisconnectReason.loggedOut]:
          "Perangkat Terkeluar, Silakan Scan/Pairing Ulang",
        [DisconnectReason.restartRequired]: "Restart Required, Restarting...",
        [DisconnectReason.timedOut]: "Connection TimedOut, Reconnecting...",
      };

      const message =
        reasonMessages[reason] || `Unknown DisconnectReason: ${reason}`;

      if (reason === DisconnectReason.loggedOut) {
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
      if (reason === DisconnectReason.restartRequired) {
        logWithTime("System", message);
        if (sock) {
          await sock.ws.close(); // Tutup WebSocket
        }

        await connectToWhatsApp(`session/${senderId}`);
      } else if (reason == 405) {
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
        { text: `✅ _Berhasil! Nomor *${senderId}* telah menjadi bot._` },
        { quoted: masterSessions.message }
      );
      if (sock) {
        await sock.ws.close(); // Tutup WebSocket
        await connectToWhatsApp(`session/${senderId}`);
      }
    }
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
        text: `_⚠️ Format Penggunaan:_\n\n_💬 Contoh:_ _*${
          prefix + command
        } 6285246154386*_\n\n_Ketik *${prefix}stopjadibot* untuk berhenti_`,
      },
      { quoted: message }
    );
    return;
  }

  // Ekstrak nomor telepon dari input
  let targetNumber = content.replace(/\D/g, ""); // Hanya angka

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

    // Mulai sesi baru
    await updateJadibot(senderId, "inactive");

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
        type_connection
      );
      return;
    } else {
      await startNewSession(
        { sock, remoteJid, message },
        senderId,
        type_connection
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
