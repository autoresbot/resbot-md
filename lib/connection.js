import config from '../config.js'; // module-alias tetap jalan karena kamu sudah set di package.json
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { initAutoBackup } from './autobackup.js';

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from 'baileys';

const store = {
  contacts: {},
};

const MAX_RECONNECT = 5;

/**
 * Status reconnect DIPISAH PER SESI (folder).
 *
 * Sebelumnya `reconnecting` & `reconnectAttempts` adalah variabel modul tunggal
 * yang dipakai bersama oleh sesi utama ("session") DAN semua sesi jadibot
 * ("session/<nomor>"). Akibatnya:
 *   - Satu jadibot yang putus membuat `reconnecting = true`, sehingga sesi utama
 *     yang ikut putus langsung `return` dan tidak pernah reconnect.
 *   - Jatah 5 percobaan dihabiskan bersama-sama lintas sesi.
 * Dengan state per folder, tiap sesi punya penghitung & kunci sendiri.
 */
const sessionStates = new Map();

function getSessionState(folder) {
  let state = sessionStates.get(folder);
  if (!state) {
    state = { reconnecting: false, attempts: 0, qrCount: 0 };
    sessionStates.set(folder, state);
  }
  return state;
}

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
import { logError } from './errorLogger.js';
import { sessions } from './cache.js';
import serializeMessage from './serializeMessage.js';
import { getJadibot } from './jadibot.js';

import { processMessage, participantUpdate } from '../autoresbot.js';

import {
  getnumberbot,
  logWithTime,
  setupSessionDirectory,
  restaring,
  success,
  danger,
  sleep,
  sendMessageWithMentionNotQuoted,
  validations,
  extractNumbers,
  getSenderType,
} from './utils.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectToWhatsApp(folder = 'session') {
  const state_session = getSessionState(folder);
  const numbersString = extractNumbers(folder);

  // Identitas sesi untuk global.statusConnected. Sesi utama memakai nomor bot
  // dari config, sesi jadibot memakai nomornya sendiri — sebelumnya semua sesi
  // menulis ke key nomor bot utama sehingga status jadibot menimpa status bot.
  const sessionId = folder === 'session' ? config.phone_number_bot : numbersString || folder;

  const dataSession = await getJadibot(numbersString);
  if (dataSession) {
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
    
    const code = config.pairing_code ? await sock.requestPairingCode(phoneNumber.trim(), config.pairing_code) : await sock.requestPairingCode(phoneNumber.trim());
    
    // Format kode pairing: pisah jadi 1234-5678
    const formattedCode = code.slice(0, 4) + '-' + code.slice(4);

    console.log(chalk.blue('PHONE NUMBER: '), chalk.yellow(phoneNumber));
    console.log(chalk.blue('CODE PAIRING: '), chalk.yellow(formattedCode));
  }

  sock.ev.on('creds.update', saveCreds);

  try {
    setupSessionDirectory(sessionDir);
  } catch (error) {
    // Bukan kondisi fatal: chmod bisa gagal di Windows / filesystem tertentu,
    // dan koneksi tetap bisa berjalan. Tetap dicatat agar tidak tak terlihat.
    console.warn('[SESSION_DIR]', error?.message || error);
  }

  sock.ev.on('contacts.update', (contacts) => {
    contacts.forEach((contact) => {
      store.contacts[contact.id] = contact;
    });
  });

  sock.ev.on('messages.upsert', async (m) => {
    // CHAT MASUK

    try {
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

      state_session.qrCount++;
      logWithTime('System', `Menampilkan QR (${state_session.qrCount}/5)`);

      qrcode.generate(qr, { small: true });

      if (state_session.qrCount >= 5) {
        console.log('Terlalu banyak QR. Stop.');
        process.exit(0);
      }
    }

    // ================= OPEN =================
    if (connection === 'open') {
      state_session.attempts = 0;
      state_session.reconnecting = false;
      state_session.qrCount = 0; // QR lama tidak boleh ikut dihitung di sesi berikutnya

      setStatusConnected(sessionId, true);

      const isSession = folder === 'session';
      success(isSession ? 'System' : 'Jadibot', 'Koneksi Terhubung');

      if (isSession) {
        try {
          const restartTargets = await restaring();
          const groupIds = restartTargets
            ? [
                ...new Set(
                  restartTargets
                    .split(/\r?\n/)
                    .map((id) => id.trim())
                    .filter((id) => id.endsWith('@g.us')),
                ),
              ]
            : [];

          let allNotificationsSent = true;

          for (const groupId of groupIds) {
            try {
              await sock.sendMessage(groupId, {
                text: '✅ _Bot berhasil online kembali setelah restart._',
              });
            } catch (error) {
              allNotificationsSent = false;
              console.log(
                chalk.redBright(`Gagal kirim notif restart ke ${groupId}: ${error.message}`),
              );
            }
          }

          if (groupIds.length > 0 && allNotificationsSent) {
            const restartingFilePath = path.join(process.cwd(), 'restaring.txt');
            if (fs.existsSync(restartingFilePath)) {
              fs.unlinkSync(restartingFilePath);
            }
          }
        } catch (error) {
          console.log(chalk.redBright(`Gagal kirim notif restart: ${error.message}`));
        }
      }

      // AUTO_BACKUP: backup saat startup + scheduler 4 jam (hanya sesi utama)
      if (isSession) {
        initAutoBackup(sock);
      }

      // auto update scheduled
      try {
        updateSocket(sock);
      } catch (error) {
        console.error('Error updating scheduled tasks:', error);
      }
      return;
    }

    // ================= CLOSE =================
    if (connection === 'close') {
      if (state_session.reconnecting) return;

      state_session.reconnecting = true;
      state_session.attempts++;

      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;

      console.log(
        chalk.yellow(`Reconnect ${state_session.attempts}/${MAX_RECONNECT} | Reason: ${reason}`),
      );

      setStatusConnected(sessionId, false);
      sessions.delete(folder);

      // ==== CLEANUP SOCKET ====
      // Dilakukan SEBELUM cooldown. Sebelumnya pembersihan baru berjalan setelah
      // delay 5-30 detik, sehingga selama jeda tersebut socket yang sudah mati
      // masih memegang listener 'messages.upsert' dan pesan yang sama bisa
      // ikut diproses lagi oleh socket lama.
      try {
        sock.ev.removeAllListeners();
        if (sock?.ws?.readyState === 1) {
          sock.ws.close();
        }
      } catch (e) {
        console.log('Cleanup error:', e.message);
      }

      // ==== STOP CONDITIONS ====
      if (reason === DisconnectReason.loggedOut) {
        console.log(chalk.bgRed('Session Logged Out. Stop reconnect.'));
        state_session.reconnecting = false;
        return;
      }

      if (state_session.attempts >= MAX_RECONNECT) {
        console.log(chalk.bgRed('Max reconnect reached. Stop.'));
        state_session.reconnecting = false;
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
        const backoff = 5000 * state_session.attempts;
        console.log(`Reconnect in ${backoff / 1000}s`);
        await delay(backoff);
      }

      state_session.reconnecting = false;

      // Reconnect dibungkus try/catch: kalau connectToWhatsApp gagal (mis.
      // fetchLatestBaileysVersion / requestPairingCode error karena jaringan),
      // sebelumnya promise-nya tidak pernah ditangani sehingga muncul
      // unhandledRejection DAN sesi berhenti selamanya tanpa percobaan lagi.
      try {
        await connectToWhatsApp(folder);
      } catch (error) {
        console.log(chalk.redBright(`Reconnect gagal (${folder}): ${error?.message || error}`));
        logError(error, { plugin: 'connection.js', command: 'reconnect', folder });
      }
      return;
    }
  });

  return sock;
}

export { connectToWhatsApp };
