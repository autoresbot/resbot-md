import { readUsers } from "../../lib/users.js";
import { sendMessageWithMention } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, senderType } = messageInfo;

  try {
    const users = await readUsers();

    // Ambil hanya pengguna yang statusnya 'block'
    const blockedUsers = Object.entries(users)
      .filter(([, userData]) => userData.status === "block")
      .map(([docId, userData]) => ({
        docId,
        username: userData.username,
        aliases: userData.aliases,
      }));

    if (blockedUsers.length === 0) {
      return await sock.sendMessage(
        remoteJid,
        { text: "⚠️ Tidak ada pengguna yang diblokir saat ini." },
        { quoted: message }
      );
    }

    // Mention memakai JID alias APA ADANYA — domainnya (@lid / @s.whatsapp.net)
    // berbeda per user dan tidak boleh ditebak dari senderType.
    const mentions = blockedUsers.map((user) => user.aliases?.[0]).filter(Boolean);

    // Format daftar pengguna
    const blockedList = blockedUsers
      .map((user) => `◧ *@${String(user.aliases?.[0] ?? user.username).split("@")[0]}*`)
      .join("\n");

    const textNotif = `📋 *LIST BLOCK:*\n\n${blockedList}\n\n_Total:_ *${blockedUsers.length}*`;

    await sendMessageWithMention(
      sock,
      remoteJid,
      textNotif,
      message,
      senderType,
      mentions
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
  Commands: ["listblock"],
  OnlyPremium: false,
  OnlyOwner: true,
};
