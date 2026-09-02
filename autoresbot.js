/*
⚠️ PERINGATAN:
Script ini **TIDAK BOLEH DIPERJUALBELIKAN** dalam bentuk apa pun!

╔══════════════════════════════════════════════╗
║                🛠️ INFORMASI SCRIPT           ║
╠══════════════════════════════════════════════╣
║ 📦 Version   : 5.3.1
║ 👨‍💻 Developer  : Azhari Creative              ║
║ 🌐 Website    : https://autoresbot.com       ║
║ 💻 GitHub  : github.com/autoresbot/resbot-md ║
╚══════════════════════════════════════════════╝

📌 Mulai 11 April 2025,
Script **Autoresbot** resmi menjadi **Open Source** dan dapat digunakan secara gratis:
🔗 https://autoresbot.com
*/

// Import ESM
import chokidar from 'chokidar';
import config from './config.js';
const mode = config.mode;

import { findGroup } from './lib/group.js';
import chalk from 'chalk';
import handler from './lib/handler.js';
import mess from './strings.js';
import { updateParticipant } from './lib/cache.js';

import path from 'path';
import { handleActiveFeatures } from './lib/participant_update.js';

import { logWithTime, log, danger, findClosestCommand, logTracking } from './lib/utils.js';

import { isOwner, isPremiumUser, updateUser, findUser } from './lib/users.js';

import { reloadPlugins } from './lib/plugins.js';
import { logCustom } from './lib/logger.js';
import { createBoundedMap } from './lib/boundedStore.js';
import { isDestinationAllowed } from './lib/destination.js';

// Variabel global
// Rate limiter memakai penyimpanan berbatas (TTL + jumlah maksimum). Versi lama
// memakai object biasa yang tidak pernah dibersihkan, sehingga setiap remoteJid
// baru menambah entri permanen selama bot hidup (memory leak).
const lastMessageTime = createBoundedMap({ max: 5000, ttl: 60 * 60 * 1000 });
const lastSent_participantUpdate = createBoundedMap({ max: 5000, ttl: 60 * 60 * 1000 });
// Throttle log "Destination handle only" agar tidak membanjiri console.
const destinationNoticeAt = createBoundedMap({ max: 5000, ttl: 60 * 60 * 1000 });
const pluginsPath = path.join(process.cwd(), 'plugins');
let plugins = [];

// Kesiapan handler & plugin.
// Sebelumnya keduanya dipanggil tanpa ditunggu, sehingga pesan yang masuk pada
// detik-detik awal startup diproses saat `handlers` masih kosong dan `plugins`
// masih [] — akibatnya handler pengaman (antilink, ban, badword, sewa) terlewat
// dan command apa pun dianggap tidak ditemukan. Promise-nya disimpan lalu
// di-await di processMessage: setelah selesai, await pada promise yang sudah
// resolved praktis tanpa biaya.
const handlersReady = handler
  .initHandlers()
  .catch((error) => console.error('❌ ERROR: Gagal memuat handler:', error));

const pluginsReady = reloadPlugins()
  .then((loadedPlugins) => {
    plugins = loadedPlugins;
    console.log(`[✔] Load All Plugins done...`);
  })
  .catch((error) => {
    console.error('❌ ERROR: Gagal memuat plugins:', error);
  });

// Hot reload hanya di development
if (mode === 'development') {
  const watcher = chokidar.watch(pluginsPath, {
    persistent: true,
    ignoreInitial: true,
    ignored: /(^|[\/\\])\../, // Abaikan file tersembunyi
  });

  watcher.on('change', (filePath) => {
    if (filePath.endsWith('.js')) {
      logWithTime('System', `File changed: ${filePath}`);

      reloadPlugins()
        .then((loadedPlugins) => {
          plugins = loadedPlugins;
        })
        .catch((error) => {
          console.error('❌ ERROR: Gagal memuat plugins:', error);
        });
    }
  });

  logWithTime('System', 'Hot reload active in development mode.');
} else {
  logWithTime('System', 'Hot reload disabled in production mode.');
}

// Fungsi utama untuk memproses pesan
async function processMessage(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender, senderLid, pushName, fullText, prefix, command } =
    messageInfo;

  const isPremiumUsers = isPremiumUser(senderLid);
  const isOwnerUsers = isOwner(senderLid) || isOwner(sender);

  try {
    // ─── Handle Destination ──────────────────────────────────────────────
    // WAJIB dicek paling awal, sebelum handler.preProcess().
    //
    // Sebelumnya pengecekan ini berada jauh di bawah — setelah preProcess —
    // sehingga hanya melindungi pencarian command. Seluruh handler di folder
    // `handle/` sudah terlanjur berjalan lebih dulu, membuat setelan 'private'
    // tidak benar-benar mematikan bot di grup: list & respon tetap dibalas,
    // antilink tetap menghapus/kick, autoai/autosimi/autorusuh tetap menjawab,
    // game tetap dijawab, dan notifikasi sewa tetap terkirim.
    if (!isDestinationAllowed(isGroup) && !isOwnerUsers) {
      // Log dibatasi agar grup yang ramai tidak membanjiri console: cukup
      // sekali per chat per menit, karena isinya selalu sama.
      const lastNotice = destinationNoticeAt.get(remoteJid);
      if (!lastNotice || Date.now() - lastNotice > 60_000) {
        destinationNoticeAt.set(remoteJid, Date.now());
        logWithTime('SYSTEM', `Destination handle only - ${config.bot_destination} chat`);
      }
      return;
    }

    // Pastikan handler & plugin selesai dimuat sebelum pesan diproses.
    await handlersReady;
    await pluginsReady;

    const shouldContinue = await handler.preProcess(sock, messageInfo);
    if (!shouldContinue) return; // Jika handler.js memutuskan untuk berhenti

    // Rate limiter
    let truncatedContent = fullText.length > 10 ? fullText.slice(0, 10) + '...' : fullText;

    const currentTime = Date.now();
    const rateLimitKey = senderLid || sender || remoteJid;
    const lastTime = lastMessageTime.get(rateLimitKey);
    if (lastTime && currentTime - lastTime < config.rate_limit && prefix && !isOwnerUsers) {
      danger(pushName, `Rate limit : ${truncatedContent}`);
      return;
    }
    if (prefix) {
      lastMessageTime.set(rateLimitKey, currentTime);
    }

    if (truncatedContent.trim() && prefix) {
      // Pastikan tidak kosong
      const logMessage =
        config.mode === 'production'
          ? () => log(pushName, truncatedContent)
          : () => logWithTime('CHAT', `${pushName}(${sender.split('@')[0]}) - ${truncatedContent}`);

      logMessage();
    }

    if (!pushName || pushName.trim() === '') {
      logWithTime('DOUBLE CHAT', `${sender.split('@')[0]} - (No Name) - ${truncatedContent}`); // JOKOWI
      //console.log(inspect(messageInfo, { depth: 2, colors: false, compact: false }));
    }

    let commandFound = false;

    // Iterasi melalui semua plugin untuk menemukan perintah yang sesuai
    for (const plugin of plugins) {
      // Plugin yang cacat (tanpa Commands / bukan array) sebelumnya membuat
      // `plugin.Commands.includes` melempar TypeError. Karena loop ini berada
      // di dalam satu try/catch besar, SATU plugin rusak akan menghentikan
      // pemrosesan SEMUA pesan — bukan hanya command miliknya sendiri.
      if (!Array.isArray(plugin?.Commands) || !plugin.Commands.includes(command)) continue;

      if (typeof plugin.handle !== 'function') {
        danger('Plugin', `Plugin untuk command "${command}" tidak punya fungsi handle`);
        continue;
      }

      commandFound = true;

      // Cek apakah perintah ini hanya untuk pengguna premium
      if (plugin.OnlyPremium && !isPremiumUsers && !isOwnerUsers) {
        logTracking(`Handler - Bukan premium (${command})`);
        await sock.sendMessage(remoteJid, { text: mess.general.isPremium }, { quoted: message });
        return;
      }

      // Cek apakah perintah ini hanya untuk owner
      if (plugin.OnlyOwner && !isOwnerUsers) {
        logTracking(`Handler - Bukan Owner (${command})`);
        await sock.sendMessage(remoteJid, { text: mess.general.isOwner }, { quoted: message });
        return;
      }

      //  fitur baru disini
      // OnlyAdmin: false, // default false
      // OnlyGroup: false, // default false
      // OnlyPrivate: false // default false

      let isGrubPremium = false;
      const settingGroups = await findGroup(remoteJid);
      if (settingGroups?.fitur?.premium && new Date(settingGroups.fitur.premium) > new Date()) {
        // Premium masih aktif
        isGrubPremium = true;
      }

      // Cek apakah perintah ini menggunakan limit
      if (!isPremiumUsers && !isOwnerUsers && plugin.limitDeduction && !isGrubPremium) {
        try {
          const dataUsers = await findUser(senderLid, 'Debug 1');
          if (!dataUsers) return;

          const [docId, userData] = dataUsers;

          const isLimitExceeded = userData.limit < plugin.limitDeduction || userData.limit < 1;
          if (isLimitExceeded) {
            logTracking('Handler - Limit habis ');
            await sock.sendMessage(remoteJid, { text: mess.general.limit }, { quoted: message });
            return;
          }

          // Kurangi limit pengguna jika masih cukup
          await updateUser(senderLid, {
            limit: userData.limit - plugin.limitDeduction,
          });
        } catch (error) {
          console.error(`Terjadi kesalahan saat mengurangi limit pengguna: ${error.message}`);
        }
      }

      const pluginResult = await plugin.handle(sock, messageInfo);

      logTracking(`Plugins - ${command} dijalankan oleh ${senderLid}`);

      // Cek apakah plugin meminta untuk menghentikan eksekusi
      if (pluginResult === false) {
        return;
      }
    }

    // sampai sini command tidak di temukan
    if (config.commandSimilarity && !commandFound) {
      const closestCommand = findClosestCommand(command, plugins);
      if (closestCommand && command != '' && fullText.length < 20 && prefix) {
        logTracking(`Handler - Command tidak ditemukan (${command})`);
        logCustom(
          'info',
          `_Command *${command}* tidak ditemukan_ \n\n_Apakah maksud Anda *.${closestCommand}*?_`,
          `ERROR-COMMAND-NOT-FOUND.txt`,
        );
        return await sock.sendMessage(
          remoteJid,
          {
            text: `_Command *${command}* tidak ditemukan_ \n\n_Apakah maksud Anda *.${closestCommand}*?_`,
          },
          { quoted: message },
        );
      }
    }
  } catch (error) {
    logCustom('error', error, `ERROR-processMessage.txt`);
    danger(command, `Kesalahan di processMessage: ${error}`);
  }
}

async function participantUpdate(sock, messageInfo) {
  const { id, action, participants } = messageInfo;
  const now = Date.now();

  try {
    const settingGroups = await findGroup(id);
    const validActions = ['promote', 'demote', 'add', 'remove'];

    if (validActions.includes(action)) {
      try {
        // updateParticipant adalah async: tanpa await, kegagalannya lolos dari
        // try/catch ini dan menjadi unhandledRejection.
        await updateParticipant(sock, id, participants, action);
      } catch (e) {
        console.log('error updateParticipant :', e?.message || e);
      }
    } else {
      return console.log('action tidak valid :', action);
    }

    // Event ini selalu berasal dari grup. Saat bot dibatasi ke chat pribadi,
    // fitur grup (welcome, goodbye, dll) tidak boleh ikut jalan.
    //
    // Pembaruan cache participant di atas sengaja TETAP dijalankan: owner masih
    // boleh memakai command di grup, jadi data peserta tidak boleh basi.
    if (!isDestinationAllowed(true)) {
      return;
    }

    // Jika grup ditemukan
    if (settingGroups) {
      const lastSent = lastSent_participantUpdate.get(id);
      if (lastSent && now - lastSent < config.rate_limit) {
        return console.log(chalk.redBright(`Rate limit : ${id}`));
      }
      lastSent_participantUpdate.set(id, now);

      await handleActiveFeatures(sock, messageInfo, settingGroups.fitur);
    }
  } catch (error) {
    logCustom('error', error, `ERROR-participantUpdate.txt`);
    console.error(chalk.redBright(`Error: ${error.message}`));
  }
}

export { processMessage, participantUpdate };
