import config from '../config.js'; // module-alias tetap jalan karena kamu sudah set di package.json
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { initAutoBackup } from './autobackup.js';

import './zapo/websocket-polyfill.js';
import { WaClient } from 'zapo-js';
import { createSessionStore } from './zapo/store.js';
import { migrateSessionIfNeeded } from './zapo/migrate.js';
import { createBaileysCompatSocket } from './zapo/socket.js';
import { createMediaProcessor } from './zapo/mediaProcessor.js';

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
    state = { reconnecting: false, attempts: 0, qrCount: 0, presenceTimer: null };
    sessionStates.set(folder, state);
  }
  return state;
}

/**
 * "Perangkat tertaut" di HP menampilkan bot sebagai TIDAK aktif selama klien
 * tidak pernah mengumumkan presence — default zapo mengirim `unavailable`
 * setelah connect (meniru tab WA Web yang tidak fokus).
 *
 * `markOnlineOnConnect: true` memperbaikinya, tapi hanya sekali saat connect;
 * server menganggap klien idle lagi setelah beberapa menit (dan setiap
 * reconnect diam-diam mengembalikannya ke status lama). Karena itu presence
 * `available` diulang secara berkala selama socket hidup.
 */
const PRESENCE_REFRESH_MS = 10 * 60 * 1000;

const isAlwaysOnline = () => config.always_online !== false;

function stopPresenceKeepAlive(state) {
  if (state.presenceTimer) {
    clearInterval(state.presenceTimer);
    state.presenceTimer = null;
  }
}

function startPresenceKeepAlive(sock, state, folder) {
  stopPresenceKeepAlive(state);

  const kirimPresence = async () => {
    try {
      await sock.sendPresenceUpdate('available');
    } catch (error) {
      // Bukan kondisi fatal: socket bisa sedang putus. Reconnect akan memulai
      // ulang keep-alive ini lewat event 'open'.
      console.log(chalk.yellow(`Presence gagal (${folder}): ${error?.message || error}`));
    }
  };

  kirimPresence();
  state.presenceTimer = setInterval(kirimPresence, PRESENCE_REFRESH_MS);
}

global.statusConnected = global.statusConnected || {};

/**
 * ID pesan yang sudah diproses (10 menit terakhir), untuk menolak pesan
 * kiriman ulang dari server. Berbatas supaya tidak menumpuk di memori.
 */
const pesanDiproses = createBoundedSet({ max: 20000, ttl: 10 * 60 * 1000 });

// Nomor yang sudah dicek dan memang tidak punya LID, supaya tidak ditanyakan
// ke server berulang-ulang setiap kali orang itu mengirim pesan.
const noLidNumbers = new Set();
// Nomor yang data user-nya sudah dicek/disatukan dengan LID pada sesi ini.
const linkedNumbers = new Set();

/**
 * Di chat pribadi, pesan kadang hanya membawa nomor HP (@s.whatsapp.net) tanpa
 * LID. Cari LID-nya (cache dulu, lalu server) supaya pengirim terdeteksi
 * dengan ID yang sama seperti di grup — cek owner/premium & data user jadi konsisten.
 *
 * Begitu nomor HP & LID-nya sama-sama diketahui, data user lama yang tercatat
 * pakai nomor HP disatukan ke data LID (sekali per nomor selama bot berjalan).
 */
async function resolveSenderLid(sock, result) {
  const { senderLid } = result;
  if (!senderLid) return;

  let pn = null;
  let lid = null;

  if (senderLid.endsWith('@lid')) {
    lid = senderLid;
    const key = result.message?.key || {};
    pn = [key.remoteJid, key.remoteJidAlt].find((j) => j?.endsWith('@s.whatsapp.net')) || null;
  } else if (senderLid.endsWith('@s.whatsapp.net')) {
    pn = senderLid;
    if (noLidNumbers.has(pn)) return;

    try {
      const found = await sock.signalRepository?.lidMapping?.getLIDForPN?.(pn);
      if (found?.endsWith('@lid')) {
        lid = found.replace(/:\d+(?=@)/, '');
        result.senderLid = lid;
      } else {
        noLidNumbers.add(pn);
      }
    } catch (error) {
      logWithTime('System', `Gagal mencari LID ${pn}: ${error?.message || error}`);
    }
  }

  if (!pn || !lid || linkedNumbers.has(pn)) return;
  linkedNumbers.add(pn);

  try {
    if (linkUserLid(pn, lid) === 'merged') {
      logWithTime('System', `Data user ${pn} disatukan ke ${lid}`);
    }
  } catch (error) {
    logWithTime('System', `Gagal menyatukan data user ${pn}: ${error?.message || error}`);
  }
}

function setStatusConnected(id, status) {
  global.statusConnected = global.statusConnected || {};
  global.statusConnected[id] = !!status; // pastikan hanya true/false
}
import qrcode from 'qrcode-terminal';
import pino from 'pino';
const logger = pino({ level: 'silent' });

import { updateSocket } from './scheduled.js';
import { syncAlarm } from './alarm.js';
import { logError } from './errorLogger.js';
import { sessions } from './cache.js';
import serializeMessage from './serializeMessage.js';
import { linkUserLid, isOwner } from './users.js';
import { isAccGroup } from './accGroups.js';
import { createBoundedSet } from './boundedStore.js';
import { getJadibot } from './jadibot.js';

import { processMessage, participantUpdate, ensureReady } from '../autoresbot.js';

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
    // errorMessage boleh berupa fungsi, supaya pesannya bisa menjelaskan
    // bagian mana dari nilainya yang bermasalah (lihat validasi pairing_code).
    const pesan = () => (typeof errorMessage === 'function' ? errorMessage() : errorMessage);

    const value = config[key]?.toLowerCase();
    if (validValues && !validValues.includes(value)) {
      return danger('Error config.js', pesan());
    }
    if (validate && !validate(config[key])) {
      return danger('Error config.js', pesan());
    }
  }

  const sessionDir = path.join(process.cwd(), folder);

  // Sesi Baileys lama (creds.json + *.json) dikonversi sekali ke store zapo
  // supaya bot yang sudah terhubung tidak perlu pairing/scan QR ulang.
  await migrateSessionIfNeeded(sessionDir, (msg) => logWithTime('Migrasi', msg));

  const store_session = createSessionStore(sessionDir);

  const client = new WaClient(
    {
      store: store_session,
      sessionId: 'default',
      auth: {
        deviceBrowser: 'chrome',
        deviceOsDisplayName: 'Ubuntu',
      },
      connectTimeoutMs: 30000,
      // Nama opsi zapo (bukan `defaultQueryTimeoutMs` milik Baileys, yang
      // diabaikan zapo sehingga query tetap memakai bawaan 15 detik). Kirim
      // pesan ke grup besar (mis. .hidetag) sering butuh lebih dari itu.
      iqTimeoutMs: 30000,
      nodeQueryTimeoutMs: 30000,
      signalFetchKeyBundlesTimeoutMs: 30000,
      // Bot tidak pernah memakai riwayat chat. Tanpa ini zapo mengunduh,
      // mendekompres & mengurai history sync dari HP setiap kali tersambung —
      // berat di panel kecil yang ikut puluhan grup. Tanda terimanya tetap
      // dikirim zapo, jadi HP tidak mengirim ulang.
      history: { enabled: false },
      keepAliveIntervalMs: 20000,
      // Umumkan online begitu tersambung supaya perangkat langsung tampil
      // "aktif"; penyegaran berkalanya ditangani startPresenceKeepAlive().
      markOnlineOnConnect: isAlwaysOnline(),
      // Tanpa processor ini zapo mengirim gambar/video TANPA jpegThumbnail,
      // sehingga previewnya kosong sampai penerima menekan unduh.
      media: { processor: createMediaProcessor() },
    },
    logger,
  );

  const sock = createBaileysCompatSocket(client, {
    contacts: store.contacts,
    storeSession: store_session.session('default'),
  });

  // Simpan sesi ke dalam Map
  sessions.set(folder, sock);

  // PAIRING
  // Berbeda dengan Baileys, kode pairing zapo diminta SAAT connect() berjalan;
  // `requestPairingCode` menolak kalau client belum terhubung.
  //
  // Pemicunya adalah event `auth_qr` yang PERTAMA, bukan `auth_pairing_required`.
  // Meski contoh di dokumentasi zapo menunggu `auth_pairing_required`, event itu
  // hanya dipancarkan saat server me-REFRESH sesi pairing yang sudah ada
  // (WaPairingFlow.js: syaratnya `this.pairingSession?.ref` sudah terisi) — dan
  // sesi itu baru ada SETELAH requestPairingCode dipanggil. Menunggunya duluan
  // berarti saling menunggu: kodenya tidak pernah muncul.
  //
  // `auth_qr` menandakan server sudah siap menerima input pairing, dan di mode
  // pairing QR-nya sendiri memang tidak dipakai.
  if (config.type_connection.toLowerCase() == 'pairing') {
    let pairingRequested = false;

    const mintaKodePairing = async () => {
      if (pairingRequested) return;
      pairingRequested = true;

      if (folder != 'session') {
        // jadibot
        logWithTime('Jadibot', `Koneksi "${folder}" terputus`, 'merah');
        return;
      }

      const phoneNumber = config.phone_number_bot;
      try {
        const code = await client.auth.requestPairingCode(
          phoneNumber.trim(),
          undefined,
          config.pairing_code || undefined,
        );

        // Format kode pairing: pisah jadi 1234-5678
        const formattedCode = code.slice(0, 4) + '-' + code.slice(4);

        console.log(chalk.blue('PHONE NUMBER: '), chalk.yellow(phoneNumber));
        console.log(chalk.blue('CODE PAIRING: '), chalk.yellow(formattedCode));
        logWithTime('System', 'Masukkan kode di HP: Perangkat Tertaut → Tautkan dengan nomor telepon');
      } catch (error) {
        // Gagal minta kode -> buka lagi kuncinya supaya percobaan berikutnya bisa jalan.
        pairingRequested = false;
        danger('Pairing', `Gagal meminta kode pairing: ${error?.message || error}`);
      }
    };

    client.on('auth_qr', mintaKodePairing);

    // Server minta kode baru (kuota refresh habis) -> minta ulang.
    client.on('auth_pairing_required', ({ forceManual } = {}) => {
      if (!forceManual) return;
      pairingRequested = false;
      mintaKodePairing();
    });
  }

  // Tidak ada `creds.update` di zapo — store menyimpan kredensial otomatis.

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

      // Pesan yang SAMA bisa datang dua kali: server mengirim ulang pesan yang
      // ack-nya tidak sampai (sering terjadi setelah socket resume / koneksi
      // tersendat). Tanpa saringan ini bot memprosesnya sebagai dua pesan
      // berbeda — itulah penyebab balasan dobel (AFK, game, respon, dll).
      const kunciPesan = `${result.remoteJid}:${result.id}`;
      if (result.id && pesanDiproses.has(kunciPesan)) {
        return;
      }
      if (result.id) pesanDiproses.add(kunciPesan);

      if (!result.isGroup) await resolveSenderLid(sock, result);

      const { id, message, remoteJid, command } = result;
      const key = message.key;

      // Grup yang belum di-.acc: bot diam total — tanpa centang biru dan tanpa
      // status "mengetik". processMessage() sendiri juga berhenti di grup ini
      // (kecuali pengirimnya owner).
      const grupDiam =
        result.isGroup && !isAccGroup(remoteJid) && !isOwner(result.senderLid);

      /* --------------------- Send Message ---------------------- */
      try {
        if (config.autoread && !grupDiam) {
          // Dibungkus sendiri: receipt yang gagal (mis. chat sudah dihapus di
          // sisi server) tidak boleh ikut membatalkan pemrosesan command —
          // dulu error di sini melompat ke catch di bawah dan pesannya tidak
          // pernah sampai ke plugin.
          try {
            await sock.readMessages([key]);
          } catch (error) {
            logWithTime('System', `Autoread gagal: ${error?.message || error}`);
          }
        }
        const validPresenceUpdates = [
          'unavailable',
          'available',
          'composing',
          'recording',
          'paused',
        ];
        // 'unavailable' membuat bot langsung tampil offline lagi di daftar
        // perangkat tertaut, jadi diabaikan selama mode selalu aktif menyala.
        const presenceValid =
          validPresenceUpdates.includes(config?.PresenceUpdate) &&
          !(isAlwaysOnline() && config.PresenceUpdate === 'unavailable');

        if (presenceValid && !grupDiam) {
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

      // Handler & plugin baru dimuat saat ada sesi (utama/jadibot) yang benar-
      // benar terhubung. Pemanggilan berikutnya (reconnect, sesi lain) tidak
      // memuat ulang. Sengaja tidak di-await agar langkah 'open' lain tetap jalan.
      ensureReady();

      // Jaga status "aktif" di menu Perangkat Tertaut selama koneksi hidup.
      if (isAlwaysOnline()) {
        startPresenceKeepAlive(sock, state_session, folder);
      } else {
        stopPresenceKeepAlive(state_session);
      }

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

      // Alarm grup dijadwalkan terpisah dari updateSocket: fungsi itu berhenti
      // lebih awal saat config.scheduled = false, sedangkan alarm dipasang
      // manual oleh admin grup jadi harus tetap jalan.
      if (isSession) {
        try {
          syncAlarm(sock);
        } catch (error) {
          console.error('Error menjadwalkan alarm:', error);
        }
      }
      return;
    }

    // ================= CLOSE =================
    if (connection === 'close') {
      if (state_session.reconnecting) return;

      state_session.reconnecting = true;
      state_session.attempts++;

      // zapo memakai kode alasan berupa string (mis. 'stream_error_replaced'),
      // bukan status code numerik ala Boom seperti Baileys.
      const reason = lastDisconnect?.error?.output?.statusCode ?? 'unknown';

      console.log(
        chalk.yellow(`Reconnect ${state_session.attempts}/${MAX_RECONNECT} | Reason: ${reason}`),
      );

      setStatusConnected(sessionId, false);
      sessions.delete(folder);

      // Timer presence milik socket lama harus mati, kalau tidak setiap
      // reconnect menambah interval baru yang menembak socket mati.
      stopPresenceKeepAlive(state_session);

      // ==== CLEANUP SOCKET ====
      // Dilakukan SEBELUM cooldown. Sebelumnya pembersihan baru berjalan setelah
      // delay 5-30 detik, sehingga selama jeda tersebut socket yang sudah mati
      // masih memegang listener 'messages.upsert' dan pesan yang sama bisa
      // ikut diproses lagi oleh socket lama.
      try {
        sock.ev.removeAllListeners();
        client.removeAllListeners();
        // disconnect() menutup socket saja. logout() akan meng-unlink device
        // dari WhatsApp — jangan dipakai untuk pembersihan reconnect.
        await client.disconnect().catch(() => {});
      } catch (e) {
        console.log('Cleanup error:', e.message);
      }

      // ==== STOP CONDITIONS ====
      if (update.isLogout) {
        console.log(chalk.bgRed('Session Logged Out. Stop reconnect.'));
        state_session.reconnecting = false;
        return;
      }

      if (state_session.attempts >= MAX_RECONNECT) {
        console.log(chalk.bgRed('Max reconnect reached. Stop.'));
        state_session.reconnecting = false;
        return;
      }

      // ==== COOLDOWN PER ALASAN ====
      // Padanan 428 (restart required) & 403 (forbidden) versi Baileys.
      const RESTART_REASONS = new Set([
        'stream_error_replaced',
        'stream_error_ack',
        'stream_error_other',
        'comms_stopped',
      ]);
      const FORBIDDEN_REASONS = new Set([
        'failure_not_authorized',
        'failure_banned',
        'failure_locked',
        'stream_error_force_login',
      ]);

      if (RESTART_REASONS.has(reason)) {
        console.log('Restart required. Cooling down 15s...');
        await delay(15000);
      } else if (FORBIDDEN_REASONS.has(reason)) {
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

  // Baileys menyambung sendiri di balik layar saat socket dibuat; zapo butuh
  // connect() eksplisit. Sengaja tidak di-await supaya fungsi ini tetap
  // mengembalikan sock segera seperti perilaku lama — kegagalan connect sudah
  // ditangani lewat event 'connection' (blok CLOSE di atas).
  client.connect().catch((error) => {
    console.log(chalk.redBright(`Connect gagal (${folder}): ${error?.message || error}`));
    logError(error, { plugin: 'connection.js', command: 'connect', folder });
  });

  return sock;
}

export { connectToWhatsApp };
