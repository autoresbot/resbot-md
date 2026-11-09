import mess from "../../strings.js";
import { getGroupMetadata, pesertaAdalahAdmin } from "../../lib/cache.js";
import { isOwner } from "../../lib/users.js";
import { applyGroupToggle } from "../../lib/groupOpenClose.js";

/**
 * Alias langsung untuk membuka/menutup grup tanpa perlu `.gc open` / `.gc close`.
 * Cukup `.open` atau `.close`. Pesan balasan mengikuti pesan custom grup bila
 * sudah diatur lewat `.setopen` / `.setclose`.
 */
async function handle(sock, messageInfo) {
  const { remoteJid, message, sender, senderLid, isGroup, command } = messageInfo;
  if (!isGroup) return; // Only Grub

  try {
    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    const isAdmin =
      pesertaAdalahAdmin(groupMetadata?.participants, sender, senderLid) || isOwner(senderLid);
    if (!isAdmin) {
      await sock.sendMessage(
        remoteJid,
        { text: mess.general.isAdmin },
        { quoted: message }
      );
      return;
    }

    const action = command === "open" ? "open" : "close";
    return await applyGroupToggle(sock, messageInfo, action);
  } catch (error) {
    return sock.sendMessage(
      remoteJid,
      {
        text: "⚠️ Terjadi kesalahan. Pastikan bot memiliki izin admin untuk mengelola grup.",
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["open", "close"],
  OnlyPremium: false,
  OnlyOwner: false,
};
