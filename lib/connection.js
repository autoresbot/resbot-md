import config from "../config.js"; // module-alias tetap jalan karena kamu sudah set di package.json
import fs from "fs";
import path from "path";
import chalk from "chalk";

import makeWASocket, {
  useMultiFileAuthState,
  getContentType,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "baileys";

import EventEmitter from "events";

const eventBus = new EventEmitter();
const store = {
  contacts: {},
};

global.statusConnected = global.statusConnected || {};

function setStatusConnected(id, status) {
  global.statusConnected = global.statusConnected || {};
  global.statusConnected[id] = !!status; // pastikan hanya true/false
}
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import pino from "pino";
const logger = pino({ level: "silent" });

import { updateSocket } from "./scheduled.js";
import { sessions } from "./cache.js";
import serializeMessage from "./serializeMessage.js";
import { updateJadibot, getJadibot } from "./jadibot.js";

import { processMessage, participantUpdate } from "../autoresbot.js";

import {
  createBackup,
  getnumberbot,
  logWithTime,
  setupSessionDirectory,
  isQuotedMessage,
  removeSpace,
  restaring,
  success,
  danger,
  sleep,
  sendMessageWithMentionNotQuoted,
  validations,
  extractNumbers,
  deleteFolderRecursive,
  getSenderType,
} from "./utils.js";


const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let qrCount = 0;
let error403Timestamps = [];

async function getTimeStamp() {
  const now = new Date();
  const options = { timeZone: "Asia/Jakarta", hour12: false };
  const timeString = now.toLocaleTimeString("id-ID", options);

  return `[${timeString}]`;
}

async function getLogFileName() {
  const now = new Date();
  const folder = path.join(process.cwd(), "logs_panel");

  // Buat folder jika belum ada
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }

  // Format nama file: YYYY-MM-DD_HH-MM.log
  return path.join(
    folder,
    `${now.getFullYear()}-${(now.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-` +
      `${now.getDate().toString().padStart(2, "0")}______` +
      `${now.getHours().toString().padStart(2, "0")}-` +
      `${now.getMinutes().toString().padStart(2, "0")}.log`
  );
}

async function debugLog(msg) {
  // Pastikan input adalah object agar tidak error
  if (typeof msg !== "object" || msg === null) {
    console.error("debugLog hanya menerima object.");
    return;
  }

  const logEntry = `${await getTimeStamp()} DEBUGGING\n${JSON.stringify(
    msg,
    null,
    2
  )}\n----------------- || ------------------\n`;
  const logFile = await getLogFileName();

  try {
    // Tulis ke file log secara async (tidak blocking)
    await fs.promises.appendFile(logFile, logEntry);
  } catch (error) {
    console.error(`Gagal menulis log: ${error.message}`);
  }
}

async function connectToWhatsApp(folder = "session") {
  let phone_number_bot = "";
  const numbersString = extractNumbers(folder);

  const dataSession = await getJadibot(numbersString);
  if (dataSession) {
    phone_number_bot = numbersString;
    if (dataSession.status == "stop" || dataSession.status == "logout") {
      return;
    }
  }

  for (const { key, validValues, validate, errorMessage } of validations) {
    const value = config[key]?.toLowerCase();
    if (validValues && !validValues.includes(value)) {
      return danger("Error config.js", errorMessage);
    }
    if (validate && !validate(config[key])) {
      return danger("Error config.js", errorMessage);
    }
  }

  const sessionDir = path.join(process.cwd(), folder);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: logger,
    printQRInTerminal: false,
    auth: state,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    // syncFullHistory: false,  // Nonaktifkan sinkronisasi riwayat chat
    // syncChats: false,  // Nonaktifkan sinkronisasi chat otomatis
    // emitOwnEvents: false,  // Hindari pemrosesan event milik sendiri
    // markOnlineOnConnect: false,  // Hindari update status online setiap terhubung
    // downloadHistory: false,  // Hindari unduhan otomatis riwayat chat
  });

  // Simpan sesi ke dalam Map
  sessions.set(folder, sock);

  if (
    !sock.authState.creds.registered &&
    config.type_connection.toLowerCase() == "pairing"
  ) {
    if (folder != "session") {
      // jadibot
      logWithTime("Jadibot", `Koneksi "${folder}" terputus`, "merah");
      return false;
    }
    const phoneNumber = config.phone_number_bot;
    await delay(4000);
    const code = await sock.requestPairingCode(phoneNumber.trim());

    // Format kode pairing: pisah jadi 1234-5678
    const formattedCode = code.slice(0, 4) + "-" + code.slice(4);

    console.log(chalk.blue("PHONE NUMBER: "), chalk.yellow(phoneNumber));
    console.log(chalk.blue("CODE PAIRING: "), chalk.yellow(formattedCode));
  }

  sock.ev.on("creds.update", saveCreds);

  try {
    setupSessionDirectory(sessionDir);
  } catch {}

  sock.ev.on("contacts.update", (contacts) => {
    contacts.forEach((contact) => {
      store.contacts[contact.id] = contact;
    });
  });

  sock.ev.on("messages.upsert", async (m) => {
    // CHAT MASUK

    try {
      eventBus.emit("contactsUpdated", store.contacts);
      // Pengelolaan Pesan Masuk pindah ke /lib/serializeMessage.js
      const result = serializeMessage(m, sock);
      if (!result) {
        return;
      }

      const { id, message, remoteJid, command } = result;
      const key = message.key;

      /* --------------------- Send Message ---------------------- */
      try {
        if (config.autoread) {
          await sock.readMessages([key]);
        }
        const validPresenceUpdates = [
          "unavailable",
          "available",
          "composing",
          "recording",
          "paused",
        ];
        if (validPresenceUpdates.includes(config?.PresenceUpdate)) {
          await sock.sendPresenceUpdate(config.PresenceUpdate, remoteJid);
        } else {
          //logWithTime('System', `PresenceUpdate Invalid: ${config?.PresenceUpdate}`);
        }
        await processMessage(sock, result);
      } catch (error) {
        console.log(`Terjadi kesalahan saat memproses pesan: ${error}`);
        //danger(command, `Terjadi kesalahan saat memproses pesan: ${error}`)
      }
    } catch (error) {
      console.log(
        chalk.redBright(`Error dalam message upsert: ${error.message}`)
      );
    }
  });

  sock.ev.on("group-participants.update", async (m) => {
    // PERUBAHAN DI GRUB

    if (!m || !m.id || !m.participants || !m.action) {
      logWithTime("System", `Participant tidak valid`);
      return;
    }
    const messageInfo = {
      id: m.id,
      participants: m.participants,
      action: m.action,
      store,
    };

    try {
      await participantUpdate(sock, messageInfo);
    } catch (error) {
      console.log(
        chalk.redBright(`Terjadi kesalahan di participant Update: ${error}`)
      );
    }
  });

  sock.ev.on("call", async (calls) => {
    // Ada yang call/videocall di chat pribadi
    if (!config.anticall) return; // jika false
    for (let call of calls) {
      if (!call.isGroup && call.status === "offer") {
        const callType = call.isVideo ? "VIDEO" : "SUARA";
        const userTag = `@${call.from.split("@")[0]}`;
        const statusJid = getSenderType(call.from);
        const messageText = `⚠️ _BOT TIDAK DAPAT MENERIMA PANGGILAN ${callType}._\n
_MAAF ${userTag}, KAMU AKAN DI *BLOCK*._
_Silakan Hubungi Owner Untuk Membuat Block!_
_Website: autoresbot.com/contact_`;

        logWithTime("System", `Call from ${call.from}`);

        await sendMessageWithMentionNotQuoted(
          sock,
          call.from,
          messageText,
          statusJid
        );
        await sleep(2000);
        await sock.updateBlockStatus(call.from, "block");
      }
    }
  });

  sock.ev.on("connection.update", async (update) => {
    // PERUBAHAN KONEKSI

    if (sock && sock.user && sock.user.id) {
      global.phone_number_bot = getnumberbot(sock.user.id);
    }

    const { connection, lastDisconnect, qr } = update;
    if (qr != null && config.type_connection.toLowerCase() == "qr") {
      if (folder != "session") {
        // jadibot
        logWithTime("Jadibot", `Koneksi "${folder}" terputus`, "merah");
        return false;
      }
      qrCount++; // Tambah 1 setiap kali QR ditampilkan
      logWithTime("System", `Menampilkan QR`);
      qrcode.generate(qr, { small: true }, (qrcodeStr) => {
        console.log(qrcodeStr);
      });
      success(
        "QR",
        `Silakan scan melalui aplikasi whatsapp!. (Try ${qrCount}/5)`
      );

      if (qrCount >= 5) {
        danger(
          "Timeout",
          "Terlalu banyak menampilkan qr, silakan coba kembali"
        );
        process.exit(0); // Menghentikan proses
      }
    }

    if (connection === "close") {
      setStatusConnected(config.phone_number_bot, false);
      await updateSocket(sock); // Update sock scheduled

      sessions.delete(folder);

      let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
      switch (reason) {
        case DisconnectReason.badSession:
          console.log(chalk.redBright(`Bad Session File, Start Again ...`));
          logWithTime("System", `Bad Session File, Start Again ...`);
          return await connectToWhatsApp(folder);
          break;

        case DisconnectReason.connectionClosed:
          console.log(chalk.redBright(`Connection closed, reconnecting....`));
          logWithTime("System", `Connection closed, reconnecting....`);
          return await connectToWhatsApp(folder);
          break;

        case DisconnectReason.connectionLost:
          console.log(
            chalk.redBright(`Connection Lost from Server, reconnecting...`)
          );
          logWithTime("System", `Connection Lost from Server, reconnecting...`);
          return await connectToWhatsApp(folder);
          break;

        case DisconnectReason.connectionReplaced:
          console.log(
            chalk.redBright(
              `Connection Replaced, Another New Session Opened, Please Restart Bot`
            )
          );
          logWithTime(
            "System",
            `Connection Replaced, Another New Session Opened, Please Restart Bot`
          );
          if (sock) {
            // Jika instance koneksi ada
            await sock.logout(); // Hapus autentikasi dan putuskan koneksi
          }
          await delay(4000);
          return await connectToWhatsApp(folder);
          break;

        case DisconnectReason.loggedOut:
          console.log(
            chalk.redBright(
              `Perangkat Terkeluar, Hapus Folder Session dan Lalukan Scan/Pairing Ulang`
            )
          );
          logWithTime(
            "System",
            `Perangkat Terkeluar, Hapus Folder Session dan Lalukan Scan/Pairing Ulang`
          );

          if (folder != "session" && phone_number_bot) {
            // jadibot

            await updateJadibot(phone_number_bot, "logout");

            if (folder != "session") {
              // jadibot
              deleteFolderRecursive(folder);
            }

            // Hapus sesi aktif
            const sockSesi = sessions.get(folder);
            if (sockSesi) {
              await sockSesi.ws.close(); // Tutup WebSocket
            }
            return;
          }
          break;

        case DisconnectReason.restartRequired:
          logWithTime("System", `Restart Required, Restarting..`);
          return await connectToWhatsApp(folder);
          break;

        case DisconnectReason.timedOut:
          console.log(chalk.redBright(`Connection TimedOut, Reconnecting...`));
          logWithTime("System", `Connection TimedOut, Reconnecting...`);
          return await connectToWhatsApp(folder);
          break;

        default:
          console.log(
            chalk.redBright(`Unknown DisconnectReason: ${reason}|${connection}`)
          );
          logWithTime(
            "System",
            `Unknown DisconnectReason: ${reason}|${connection}`
          );
          if (folder != "session" && phone_number_bot) {
            // jadibot

            await updateJadibot(phone_number_bot, "baned");
          }
          const now = Date.now();

          // Jika error 403
          if (reason === 403) {
            // Simpan timestamp saat ini
            error403Timestamps.push(now);

            // Filter: hanya timestamp dalam 60 detik terakhir
            error403Timestamps = error403Timestamps.filter(
              (ts) => now - ts < 60000
            );

            // Jika lebih dari 3 dalam 1 menit
            if (error403Timestamps.length > 3) {
              console.log(
                chalk.bgRed(
                  "[BLOCKED] Terlalu banyak error 403 dalam 1 menit. Stop reconnect sementara."
                )
              );
              return; // Tidak reconnect
            }

            console.log(
              chalk.yellow("⚠️ Terjadi error 403. Mencoba reconnect...")
            );
            await connectToWhatsApp(folder); // Lanjutkan reconnect
            return;
          }

          return await connectToWhatsApp(folder);
          break;
      }
    } else if (connection === "open") {
      setStatusConnected(config.phone_number_bot, true);

      const isSession = folder === "session";
      success(isSession ? "System" : "Jadibot", "Koneksi Terhubung");

      if (!isSession && phone_number_bot) {
        await updateJadibot(phone_number_bot, "active");
      }

      const isRestart = await restaring();
      if (isRestart) {
        if (isSession) {
          await sock.sendMessage(isRestart, {
            text: "_Bot Berhasil di restart_",
          });
        }
      } else if (isSession) {
        await sock.sendMessage(`${config.phone_number_bot}@s.whatsapp.net`, {
          text: "_Bot Connected_",
        });
      }

      try {
        await updateSocket(sock); // Update sock scheduled
      } catch (error) {
        console.log(
          chalk.redBright(
            `Error dalam menjalan updateSocket atau waktuSholat : ${error.message}`
          )
        );
      }

      try {
        if (config.autobackup && folder == "session") {
          const backupFilePath = await createBackup();
          const filename = "autoresbot backup.zip";
          const documentPath = backupFilePath.path;

          await sock.sendMessage(`${config.owner_number[0]}@s.whatsapp.net`, {
            document: { url: documentPath },
            fileName: filename,
            mimetype: "application/zip",
          });

          // Log keberhasilan backup
          logWithTime("System", `Backup berhasil: ${backupFilePath}`);
        }
      } catch (error) {
        // Tangani error dengan memberikan informasi ke log
        console.error("Terjadi error saat proses backup:", error.message);
      }
    }
  });

  return sock;
}

export { connectToWhatsApp };
