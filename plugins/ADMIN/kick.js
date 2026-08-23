import mess from "../../strings.js";
import config from "../../config.js";
import { getGroupMetadata } from "../../lib/cache.js";
import { determineUser } from "../../lib/utils.js";
import { isOwner } from "../../lib/users.js";

async function handle(sock, messageInfo) {
  const {
    remoteJid,
    isGroup,
    message,
    sender,
    mentionedJid,
    isQuoted,
    content,
    prefix,
    command,
  } = messageInfo;
  if (!isGroup) return; // Only Grub
  try {
    // Mendapatkan metadata grup
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

    // Menentukan pengguna
    const userToAction = determineUser(mentionedJid, isQuoted, content);
    if (!userToAction) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
            prefix + command
          } @NAME*_`,
        },
        { quoted: message }
      );
    }

    const targetNumber = userToAction.split("@")[0];

    // Guard nomor bot: bandingkan dengan identitas asli sock (nomor & LID),
    // bukan hanya placeholder config.phone_number_bot.
    const selfNumbers = new Set();
    for (const jid of [sock?.user?.id, sock?.user?.lid]) {
      const digits = String(jid || "")
        .split("@")[0]
        .split(":")[0]
        .replace(/\D/g, "");
      if (digits) selfNumbers.add(digits);
    }
    if (/^\d+$/.test(config.phone_number_bot || "")) {
      selfNumbers.add(config.phone_number_bot);
    }

    if (selfNumbers.has(targetNumber)) {
      return await sock.sendMessage(
        remoteJid,
        { text: `⚠️ _Tidak dapat kick nomor sendiri_` },
        { quoted: message }
      );
    }

    if (isOwner(userToAction)) {
      return await sock.sendMessage(
        remoteJid,
        { text: `⚠️ _Tidak dapat kick owner_` },
        { quoted: message }
      );
    }

    // Mengeluarkan pengguna dari grup
    const kickResult = await sock.groupParticipantsUpdate(
      remoteJid,
      [userToAction],
      "remove"
    );

    // Baileys tidak throw untuk kegagalan per-participant; status harus dicek.
    const status = Array.isArray(kickResult) ? kickResult[0]?.status : undefined;

    if (mess.action.user_kick && (status === undefined || status === 200)) {
      return await sock.sendMessage(
        remoteJid,
        { text: mess.action.user_kick },
        { quoted: message }
      );
    }

    return await sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ _Gagal mengeluarkan peserta${
          status ? ` (kode ${status})` : ""
        }. Pastikan bot admin dan target tidak dilindungi._`,
      },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error handling kick:", error);
    await sock.sendMessage(
      remoteJid,
      {
        text: "⚠️ Terjadi kesalahan saat mencoba mengeluarkan pengguna. Pastikan bot memiliki izin.",
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["kick"],
  OnlyPremium: false,
  OnlyOwner: false,
};
