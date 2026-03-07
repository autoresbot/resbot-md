import config from '../config.js'; // module-alias tetap jalan karena kamu sudah set di package.json
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { listOwner } from '../lib/users.js';

import makeWASocket, {
  useMultiFileAuthState,
  getContentType,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from 'baileys';

import EventEmitter from 'events';

const eventBus = new EventEmitter();
const store = {
  contacts: {},
};

let reconnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;
const RECONNECT_DELAY = 5000; // 5 detik

global.statusConnected = global.statusConnected || {};

function setStatusConnected(id, status) {
  global.statusConnected = global.statusConnected || {};
  global.statusConnected[id] = !!status; // pastikan hanya true/false
}
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
const logger = pino({ level: 'silent' });

import { updateSocket } from './scheduled.js';
import { sessions } from './cache.js';
import serializeMessage from './serializeMessage.js';
import { updateJadibot, getJadibot } from './jadibot.js';

import { processMessage, participantUpdate } from '../autoresbot.js';

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
} from './utils.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let qrCount = 0;
let error403Timestamps = [];

async function getTimeStamp() {
  const now = new Date();
  const options = { timeZone: 'Asia/Jakarta', hour12: false };
  const timeString = now.toLocaleTimeString('id-ID', options);

  return `[${timeString}]`;
}

async function getLogFileName() {
  const now = new Date();
  const folder = path.join(process.cwd(), 'logs_panel');

  // Buat folder jika belum ada
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }

  // Format nama file: YYYY-MM-DD_HH-MM.log
  return path.join(
    folder,
    `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-` +
      `${now.getDate().toString().padStart(2, '0')}______` +
      `${now.getHours().toString().padStart(2, '0')}-` +
      `${now.getMinutes().toString().padStart(2, '0')}.log`,
  );
}

async function debugLog(msg) {
  // Pastikan input adalah object agar tidak error
  if (typeof msg !== 'object' || msg === null) {
    console.error('debugLog hanya menerima object.');
    return;
  }

  const logEntry = `${await getTimeStamp()} DEBUGGING\n${JSON.stringify(
    msg,
    null,
    2,
  )}\n----------------- || ------------------\n`;
  const logFile = await getLogFileName();

  try {
    // Tulis ke file log secara async (tidak blocking)
    await fs.promises.appendFile(logFile, logEntry);
  } catch (error) {
    console.error(`Gagal menulis log: ${error.message}`);
  }
}

async function connectToWhatsApp(folder = 'session') {
  let phone_number_bot = '';
  const numbersString = extractNumbers(folder);

  const dataSession = await getJadibot(numbersString);
  if (dataSession) {
    phone_number_bot = numbersString;
    if (dataSession.status == 'stop' || dataSession.status == 'logout') {
      return;
    }
  }

  for (const { key, validValues, validate, errorMessage } of validations) {
    const value = config[key]?.toLowerCase();
    if (validValues && !validValues.includes(value)) {
      return danger('Error config.js', errorMessage);
    }
    if (validate && !validate(config[key])) {
      return danger('Error config.js', errorMessage);
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
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    connectTimeoutMs: 30000,
    defaultQueryTimeoutMs: 30000,

    keepAliveIntervalMs: 20000,
  });

  // Simpan sesi ke dalam Map
  sessions.set(folder, sock);

  if (!sock.authState.creds.registered && config.type_connection.toLowerCase() == 'pairing') {
    if (folder != 'session') {
      // jadibot
      logWithTime('Jadibot', `Koneksi "${folder}" terputus`, 'merah');
      return false;
    }
    const phoneNumber = config.phone_number_bot;
    await delay(4000);
    const code = await sock.requestPairingCode(phoneNumber.trim());

    // Format kode pairing: pisah jadi 1234-5678
    const formattedCode = code.slice(0, 4) + '-' + code.slice(4);

    console.log(chalk.blue('PHONE NUMBER: '), chalk.yellow(phoneNumber));
    console.log(chalk.blue('CODE PAIRING: '), chalk.yellow(formattedCode));
  }

  sock.ev.on('creds.update', saveCreds);

  try {
    setupSessionDirectory(sessionDir);
  } catch {}

  sock.ev.on('contacts.update', (contacts) => {
    contacts.forEach((contact) => {
      store.contacts[contact.id] = contact;
    });
  });

  sock.ev.on('messages.upsert', async (m) => {
    // CHAT MASUK

    try {
      eventBus.emit('contactsUpdated', store.contacts);
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
          'unavailable',
          'available',
          'composing',
          'recording',
          'paused',
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
      console.log(chalk.redBright(`Error dalam message upsert: ${error.message}`));
    }
  });

  sock.ev.on('group-participants.update', async (m) => {
    // PERUBAHAN DI GRUB

    if (!m || !m.id || !m.participants || !m.action) {
      logWithTime('System', `Participant tidak valid`);
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
      console.log(chalk.redBright(`Terjadi kesalahan di participant Update: ${error}`));
    }
  });

  sock.ev.on('call', async (calls) => {
    // Ada yang call/videocall di chat pribadi
    if (!config.anticall) return; // jika false
    for (let call of calls) {
      if (!call.isGroup && call.status === 'offer') {
        const callType = call.isVideo ? 'VIDEO' : 'SUARA';
        const userTag = `@${call.from.split('@')[0]}`;
        const statusJid = getSenderType(call.from);
        const messageText = `⚠️ _BOT TIDAK DAPAT MENERIMA PANGGILAN ${callType}._\n
_MAAF ${userTag}, KAMU AKAN DI *BLOCK*._
_Silakan Hubungi Owner Untuk Membuat Block!_
_Website: autoresbot.com/contact_`;

        logWithTime('System', `Call from ${call.from}`);

        await sendMessageWithMentionNotQuoted(sock, call.from, messageText, statusJid);
        await sleep(2000);
        await sock.updateBlockStatus(call.from, 'block');
      }
    }
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (sock?.user?.id) {
      global.phone_number_bot = getnumberbot(sock.user.id);
    }

    // ================= QR =================
    if (qr && config.type_connection.toLowerCase() === 'qr') {
      if (folder !== 'session') return;

      qrCount++;
      logWithTime('System', `Menampilkan QR (${qrCount}/5)`);

      qrcode.generate(qr, { small: true });

      if (qrCount >= 5) {
        console.log('Terlalu banyak QR. Stop.');
        process.exit(0);
      }
    }

    // ================= OPEN =================
    if (connection === 'open') {
      reconnectAttempts = 0;
      reconnecting = false;

      setStatusConnected(config.phone_number_bot, true);

      const isSession = folder === 'session';
      success(isSession ? 'System' : 'Jadibot', 'Koneksi Terhubung');

      // Cek Autobackup
      if (config.autobackup) {
        console.log('Membuat backup data...');

        try {
          const owners = listOwner();

          const backupFilePath = await createBackup();

          const documentPath = backupFilePath.path;

          // kirim ke nomor bot
          await sock.sendMessage(`${config.phone_number_bot}@s.whatsapp.net`, {
            document: { url: documentPath },
            fileName: 'File Backup',
            mimetype: 'application/zip',
          });

          // kirim ke semua owner
          if (owners && owners.length > 0) {
            for (const owner of owners) {
              await sock.sendMessage(owner, {
                document: { url: documentPath },
                fileName: 'File Backup',
                mimetype: 'application/zip',
              });
            }
          }
        } catch (err) {
          console.error('Backup failed:', err);

          await sock.sendMessage(
            remoteJid,
            {
              text: `❌ _Gagal melakukan backup:_ ${err.message}`,
            },
            { quoted: message },
          );
        }
      }

      return;
    }

    // ================= CLOSE =================
    if (connection === 'close') {
      if (reconnecting) return;

      reconnecting = true;
      reconnectAttempts++;

      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;

      console.log(
        chalk.yellow(`Reconnect ${reconnectAttempts}/${MAX_RECONNECT} | Reason: ${reason}`),
      );

      setStatusConnected(config.phone_number_bot, false);
      sessions.delete(folder);

      // ==== STOP CONDITIONS ====
      if (reason === DisconnectReason.loggedOut) {
        console.log(chalk.bgRed('Session Logged Out. Stop reconnect.'));
        reconnecting = false;
        return;
      }

      if (reconnectAttempts >= MAX_RECONNECT) {
        console.log(chalk.bgRed('Max reconnect reached. Stop.'));
        reconnecting = false;
        return;
      }

      // ==== HANDLE 428 (Restart Required) ====
      if (reason === 428) {
        console.log('Restart required. Cooling down 15s...');
        await delay(15000);
      } else if (reason === 403) {
        console.log('Forbidden. Cooling down 30s...');
        await delay(30000);
      } else {
        // exponential backoff
        const backoff = 5000 * reconnectAttempts;
        console.log(`Reconnect in ${backoff / 1000}s`);
        await delay(backoff);
      }

      // ==== CLEANUP SOCKET ====
      try {
        sock.ev.removeAllListeners();
        if (sock?.ws?.readyState === 1) {
          sock.ws.close();
        }
      } catch (e) {
        console.log('Cleanup error:', e.message);
      }

      reconnecting = false;
      return connectToWhatsApp(folder);
    }
  });

  return sock;
}

export { connectToWhatsApp };
