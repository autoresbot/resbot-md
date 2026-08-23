const batasPeringatan = 3;

import mess from "../../strings.js";
import config from "../../config.js";
import { getGroupMetadata } from "../../lib/cache.js";
import { sendMessageWithMention, determineUser } from "../../lib/utils.js";
import { isOwner } from "../../lib/users.js";

// Warning list disimpan di memori (RAM), key per grup agar hitungan
// tidak tercampur antar grup.
const warningList = {};

function getWarningKey(remoteJid, userJid) {
  return `${remoteJid}:${userJid}`;
}

function splitWarningKey(key) {
  const idx = key.indexOf(":");
  return idx === -1 ? [key, ""] : [key.slice(0, idx), key.slice(idx + 1)];
}

function isProtectedTarget(sock, userJid) {
  const targetNumber = String(userJid).split("@")[0].replace(/\D/g, "");
  if (!targetNumber) return true;

  for (const jid of [sock?.user?.id, sock?.user?.lid]) {
    const botNumber = String(jid || "")
      .split("@")[0]
      .split(":")[0]
      .replace(/\D/g, "");
    if (botNumber && botNumber === targetNumber) return true;
  }

  if (
    /^\d+$/.test(config.phone_number_bot || "") &&
    config.phone_number_bot === targetNumber
  ) {
    return true;
  }

  return isOwner(userJid);
}

async function handle(sock, messageInfo) {
  const {
    remoteJid,
    isGroup,
    message,
    sender,
    content,
    prefix,
    command,
    mentionedJid,
    isQuoted,
    senderType,
  } = messageInfo;

  if (!isGroup) return;

  const groupMetadata = await getGroupMetadata(sock, remoteJid);
  const participants = groupMetadata.participants;
  const isAdmin = participants.some(
    (p) => (p.phoneNumber === sender || p.id === sender) && p.admin
  );

  if (!isAdmin) {
    await sock.sendMessage(
      remoteJid,
      { text: mess.general.isAdmin },
      { quoted: message }
    );
    return;
  }

  // Debug internal RAM warning list
  if (command === "debugwarn") {
    console.log("🔧 Debug warningList:", warningList);
    return await sock.sendMessage(
      remoteJid,
      {
        text: "📦 Debug log dikirim ke console.",
      },
      { quoted: message }
    );
  }

  // Menampilkan daftar warning
  if (command === "listwarning" || command === "listwarn") {
    let warningText = "⚠️ *Daftar Peringatan:*\n\n";
    let mentions = [];
    let found = false;

    for (const key in warningList) {
      const count = warningList[key];
      if (count <= 0) continue;

      const [keyGroup, userJid] = splitWarningKey(key);
      if (keyGroup !== remoteJid) continue;

      warningText += `👤 @${userJid.split("@")[0]}: ${count}/${batasPeringatan} peringatan\n`;
      mentions.push(userJid);
      found = true;
    }

    if (!found) warningText = "✅ Tidak ada pengguna yang memiliki peringatan.";

    await sock.sendMessage(
      remoteJid,
      {
        text: warningText,
        mentions: mentions,
      },
      { quoted: message }
    );
    return;
  }

  // Menghapus warning user
  if (command === "deletewarning" || command === "delwarning") {
    const userToDelete = determineUser(mentionedJid, isQuoted, content);
    if (!userToDelete) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ *${
            prefix + command
          } 628xxxx*`,
        },
        { quoted: message }
      );
    }

    const deleteKey = getWarningKey(remoteJid, userToDelete);

    if (warningList[deleteKey]) {
      delete warningList[deleteKey];
      await sendMessageWithMention(
        sock,
        remoteJid,
        `✅ Peringatan untuk @${userToDelete.split("@")[0]} telah dihapus.`,
        message,
        senderType
      );
    } else {
      await sendMessageWithMention(
        sock,
        remoteJid,
        `❌ @${userToDelete.split("@")[0]} tidak memiliki peringatan.`,
        message,
        senderType
      );
    }
    return;
  }

  // Jika command warn
  if (command === "warn" || command === "warning") {
    const userToWarn = determineUser(mentionedJid, isQuoted, content);
    if (!userToWarn) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ *${
            prefix + command
          } 628xxxx*`,
        },
        { quoted: message }
      );
    }

    const whatsappJid = userToWarn;

    if (isProtectedTarget(sock, whatsappJid)) {
      return await sendMessageWithMention(
        sock,
        remoteJid,
        `⚠️ _Tidak dapat memperingati @${whatsappJid.split("@")[0]}._`,
        message,
        senderType
      );
    }

    const warningKey = getWarningKey(remoteJid, whatsappJid);

    try {
      warningList[warningKey] = (warningList[warningKey] || 0) + 1;

      if (warningList[warningKey] >= batasPeringatan) {
        await sendMessageWithMention(
          sock,
          remoteJid,
          `❌ _@${
            whatsappJid.split("@")[0]
          } telah mencapai batas peringatan dan akan dikeluarkan dari grup._`,
          message,
          senderType
        );
        await sock.groupParticipantsUpdate(remoteJid, [whatsappJid], "remove");
        delete warningList[warningKey];
        return;
      }

      await sendMessageWithMention(
        sock,
        remoteJid,
        `⚠️ @${whatsappJid.split("@")[0]} telah diperingati (${
          warningList[warningKey]
        }/${batasPeringatan})`,
        message,
        senderType
      );
    } catch (error) {
      await sendMessageWithMention(
        sock,
        remoteJid,
        `❌ _Tidak dapat memberikan warning ke nomor_ @${
          whatsappJid.split("@")[0]
        }`,
        message,
        senderType
      );
    }
  }
}

export default {
  handle,
  Commands: [
    "warn",
    "warning",
    "listwarning",
    "listwarn",
    "deletewarning",
    "delwarning",
    "debugwarn",
  ],
  OnlyPremium: false,
  OnlyOwner: false,
};
