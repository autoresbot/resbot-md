import { readUsers } from "../../lib/users.js";
import { sendMessageWithMention } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, senderType } = messageInfo;

  try {
    const users = await readUsers();

    // Ambil hanya pengguna yang statusnya 'blacklist'
    const blacklistedUsers = Object.entries(users)
      .filter(([, userData]) => userData.status === "blacklist")
      .map(([docId, userData]) => ({
        docId,
        username: userData.username,
        aliases: userData.aliases,
      }));

    if (blacklistedUsers.length === 0) {
      return await sock.sendMessage(
        remoteJid,
        { text: "⚠️ Tidak ada pengguna yang di blacklist saat ini." },
        { quoted: message }
      );
    }

    // Format daftar blacklist (pakai username)
    const blockedList = blacklistedUsers
      .map((user, index) => `◧ *${user.username}*`)
      .join("\n");

    const textNotif = `📋 *BLACKLIST:*\n\n${blockedList}\n\n_Total:_ *${blacklistedUsers.length}*`;

    await sendMessageWithMention(
      sock,
      remoteJid,
      textNotif,
      message,
      senderType
    );
  } catch (error) {
    console.error("Error fetching users:", error);
    await sock.sendMessage(
      remoteJid,
      { text: "Terjadi kesalahan saat memproses data pengguna." },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["listblacklist"],
  OnlyPremium: false,
  OnlyOwner: true,
};
