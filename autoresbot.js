/*
⚠️ PERINGATAN:
Script ini **TIDAK BOLEH DIPERJUALBELIKAN** dalam bentuk apa pun!

╔══════════════════════════════════════════════╗
║                🛠️ INFORMASI SCRIPT           ║
╠══════════════════════════════════════════════╣
║ 📦 Version   : 4.3.1
║ 👨‍💻 Developer  : Azhari Creative              ║
║ 🌐 Website    : https://autoresbot.com       ║
║ 💻 GitHub  : github.com/autoresbot/resbot-md ║
╚══════════════════════════════════════════════╝

📌 Mulai 11 April 2025,
Script **Autoresbot** resmi menjadi **Open Source** dan dapat digunakan secara gratis:
🔗 https://autoresbot.com
*/

const commandWithoutRegister = ["list", "owner", "menu", "claim"];

const chokidar = require("chokidar");
const config = require("@config");
const mode = config.mode;
const { findGroup } = require("@lib/group");
const chalk = require("chalk");
const handler = require("./lib/handler");
const mess = require("@mess");
const { updateParticipant } = require("@lib/cache");
const lastMessageTime = {};
const path = require("path");
const { handleActiveFeatures } = require("./lib/participant_update");
const {
  logWithTime,
  log,
  danger,
  findClosestCommand,
  logTracking,
} = require("@lib/utils");
const {
  isOwner,
  isPremiumUser,
  updateUser,
  findUser,
  isUserRegistered,
} = require("@lib/users");
const pluginsPath = path.join(process.cwd(), "plugins");
const lastSent_participantUpdate = {};

const { reloadPlugins } = require("@lib/plugins");
const { logCustom } = require("@lib/logger");
let plugins = [];

reloadPlugins()
  .then((loadedPlugins) => {
    plugins = loadedPlugins;
  })
  .catch((error) => {
    console.error("❌ ERROR: Gagal memuat plugins:", error);
  });

if (mode === "development") {
  const chokidar = require("chokidar");
  const watcher = chokidar.watch(pluginsPath, {
    persistent: true,
    ignoreInitial: true,
    ignored: /(^|[\/\\])\../, // Abaikan file tersembunyi.
  });

  watcher.on("change", (filePath) => {
    if (filePath.endsWith(".js")) {
      logWithTime("System", `File changed: ${filePath}`);

      reloadPlugins()
        .then((loadedPlugins) => {
          plugins = loadedPlugins;
        })
        .catch((error) => {
          console.error("❌ ERROR: Gagal memuat plugins:", error);
        });
    }
  });

  logWithTime("System", "Hot reload active in development mode.");
} else {
  logWithTime("System", "Hot reload disabled in production mode.");
}

// Fungsi utama untuk memproses pesan
async function processMessage(sock, messageInfo) {
  const {
    remoteJid,
    isGroup,
    message,
    sender,
    pushName,
    fullText,
    prefix,
    command,
  } = messageInfo;

  const isPremiumUsers = await isPremiumUser(sender);
  const isOwnerUsers = await isOwner(sender);

  try {
    const shouldContinue = await handler.preProcess(sock, messageInfo);
    if (!shouldContinue) return; // Jika handler.js memutuskan untuk berhenti

    // Rate limiter
    let truncatedContent =
      fullText.length > 10 ? fullText.slice(0, 10) + "..." : fullText;

    const currentTime = Date.now();
    if (
      lastMessageTime[remoteJid] &&
      currentTime - lastMessageTime[remoteJid] < config.rate_limit &&
      prefix &&
      !isOwnerUsers
    ) {
      danger(pushName, `Rate limit : ${truncatedContent}`);
      return;
    }
    if (prefix) {
      lastMessageTime[remoteJid] = currentTime;
    }

    if (truncatedContent.trim() && prefix) {
      // Pastikan tidak kosong
      const logMessage =
        config.mode === "production"
          ? () => log(pushName, truncatedContent)
          : () =>
              logWithTime(
                "CHAT",
                `${pushName}(${sender.split("@")[0]}) - ${truncatedContent}`
              );

      logMessage();
    }

    // Handle Destination
    if (
      (config.bot_destination.toLowerCase() === "private" && isGroup) ||
      (config.bot_destination.toLowerCase() === "group" && !isGroup)
    ) {
      if (!isOwnerUsers) {
        logWithTime(
          "SYSTEM",
          `Destination handle only - ${config.bot_destination} chat`
        );
        return;
      }
    }

    let commandFound = false;

    // Iterasi melalui semua plugin untuk menemukan perintah yang sesuai
    for (const plugin of plugins) {
      if (plugin.Commands.includes(command)) {
        commandFound = true;

        // Handler:
        if (!isUserRegistered(sender) && command.toLowerCase() !== "register") {
          // Kalau command ada di commandWithoutRegister, skip peringatan
          if (!commandWithoutRegister.includes(command.toLowerCase())) {

              await sock.sendMessage(
                remoteJid,
                {
                  text:
                    mess.general?.isNotRegister ||
                    "❗ Kamu belum terdaftar. Ketik *.register* dulu ya!",
                },
                { quoted: message }
              );
           
            return;
          }
        }

        // Cek apakah perintah ini hanya untuk pengguna premium
        if (plugin.OnlyPremium && !isPremiumUsers && !isOwnerUsers) {
          logTracking(`Handler - Bukan premium (${command})`);
          await sock.sendMessage(
            remoteJid,
            { text: mess.general.isPremium },
            { quoted: message }
          );
          return;
        }

        // Cek apakah perintah ini hanya untuk owner
        if (plugin.OnlyOwner && !isOwnerUsers) {
          logTracking(`Handler - Bukan Owner (${command})`);
          await sock.sendMessage(
            remoteJid,
            { text: mess.general.isOwner },
            { quoted: message }
          );
          return;
        }

        // Cek apakah perintah ini menggunakan limit
        if (!isPremiumUsers && !isOwnerUsers && plugin.limitDeduction) {
          try {
            const dataUsers = await findUser(sender);
            if (!dataUsers) return;

            const [docId, userData] = dataUsers;

            const isLimitExceeded =
              userData.limit < plugin.limitDeduction || userData.limit < 1;
            if (isLimitExceeded) {
              logTracking("Handler - Limit habis ");
              await sock.sendMessage(
                remoteJid,
                { text: mess.general.limit },
                { quoted: message }
              );
              return;
            }

            // Kurangi limit pengguna jika masih cukup
            await updateUser(sender, {
              limit: userData.limit - plugin.limitDeduction,
            });
          } catch (error) {
            console.error(
              `Terjadi kesalahan saat mengurangi limit pengguna: ${error.message}`
            );
          }
        }

        const pluginResult = await plugin.handle(sock, messageInfo);

        logTracking(`Plugins - ${command} dijalankan oleh ${sender}`);

        // Cek apakah plugin meminta untuk menghentikan eksekusi
        if (pluginResult === false) {
          return;
        }
      }
    }

    // sampai sini command tidak di temukan
    if (config.commandSimilarity && !commandFound) {
      const closestCommand = findClosestCommand(command, plugins);
      if (closestCommand && command != "" && fullText.length < 20 && prefix) {
        logTracking(`Handler - Command tidak ditemukan (${command})`);
        logCustom(
          "info",
          `_Command *${command}* tidak ditemukan_ \n\n_Apakah maksud Anda *.${closestCommand}*?_`,
          `ERROR-COMMAND-NOT-FOUND.txt`
        );
        await sock.sendMessage(
          remoteJid,
          {
            text: `_Command *${command}* tidak ditemukan_ \n\n_Apakah maksud Anda *.${closestCommand}*?_`,
          },
          { quoted: message }
        );
      }
    }
  } catch (error) {
    logCustom("info", error, `ERROR-processMessage.txt`);
    danger(command, `Kesalahan di processMessage: ${error}`);
  }
}

async function participantUpdate(sock, messageInfo) {
  const { id, action, participants } = messageInfo;
  const now = Date.now();

  try {
    const settingGroups = await findGroup(id);
    const validActions = ["promote", "demote", "add", "remove"];

    if (validActions.includes(action)) {
      try {
        updateParticipant(sock, id, participants, action);
      } catch (e) {
        console.log("error updateParticipant ", e);
      }
    } else {
      return console.log("action tidak valid :", action);
    }
    // Jika grup ditemukan
    if (settingGroups) {
      if (lastSent_participantUpdate[id]) {
        if (now - lastSent_participantUpdate[id] < config.rate_limit) {
          return console.log(chalk.redBright(`Rate limit : ${id}`));
        }
      }
      lastSent_participantUpdate[id] = now;

      await handleActiveFeatures(sock, messageInfo, settingGroups.fitur);
    }
  } catch (error) {
    logCustom("info", error, `ERROR-participantUpdate.txt`);
    console.error(chalk.redBright(`Error: ${error.message}`));
  }
}

module.exports = { processMessage, participantUpdate };
