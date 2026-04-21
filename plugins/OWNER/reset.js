import { reset } from "../../lib/utils.js";
import { updateSocket } from "../../lib/scheduled.js";
import { clearCache } from "../../lib/globalCache.js";
import { resetUsers, resetOwners } from "../../lib/users.js";
import { resetGroup } from "../../lib/group.js";
import { resetAllTotalChat } from "../../lib/totalchat.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;

  if (!content.trim().toLowerCase().endsWith("-y")) {
    await sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ _Perintah ini akan menghapus seluruh database yang tersimpan pada bot._ \n\nSilakan ketik *${
          prefix + command
        } -y* untuk melanjutkan.`,
      },
      { quoted: message }
    );
    return;
  }

  try {
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    resetUsers();
    resetOwners();
    resetGroup();
    resetAllTotalChat();

    clearCache();

    await reset();

    await updateSocket(sock);

    await sock.sendMessage(
      remoteJid,
      { text: "✅ _Semua Database telah direset_" },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error during database reset:", error);
    await sock.sendMessage(
      remoteJid,
      { text: "_❌ Maaf, terjadi kesalahan saat mereset data._" },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["reset"],
  OnlyPremium: false,
  OnlyOwner: true,
};
