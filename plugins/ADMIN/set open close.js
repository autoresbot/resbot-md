import mess from "../../strings.js";
import { getGroupMetadata, pesertaAdalahAdmin } from "../../lib/cache.js";
import { isOwner } from "../../lib/users.js";
import { setJadwalTeks } from "../../lib/participants.js";

/**
 * `.setopen <teks>`  -> atur pesan balasan saat grup DIBUKA (.open / .gc open)
 * `.setclose <teks>` -> atur pesan balasan saat grup DITUTUP (.close / .gc close)
 * `.setopen reset`   -> kembalikan ke pesan default (strings.js)
 *
 * Pesan disimpan di openText/closeText (lib/participants.js) — penyimpanan yang
 * sama dengan jadwal otomatis .setopengc/.setclosegc, jadi pesan custom berlaku
 * untuk buka/tutup manual maupun otomatis.
 */
async function handle(sock, messageInfo) {
  const { remoteJid, message, sender, senderLid, isGroup, content, prefix, command } =
    messageInfo;
  if (!isGroup) return;

  const property = command === "setopen" ? "openText" : "closeText";
  const labelAksi = command === "setopen" ? "buka" : "tutup";

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

    const teks = (content || "").trim();

    if (!teks) {
      return sock.sendMessage(
        remoteJid,
        {
          text:
            `_⚠️ Format Penggunaan:_\n\n` +
            `_💬 Atur pesan:_ *${prefix + command} Grup berhasil di${labelAksi}*\n` +
            `_♻️ Reset ke default:_ *${prefix + command} reset*`,
        },
        { quoted: message }
      );
    }

    // Reset -> kosongkan sehingga kembali ke pesan default
    if (teks.toLowerCase() === "reset") {
      await setJadwalTeks(remoteJid, property, "");
      return sock.sendMessage(
        remoteJid,
        {
          text: `♻️ _Pesan saat grup di${labelAksi} dikembalikan ke default._`,
        },
        { quoted: message }
      );
    }

    await setJadwalTeks(remoteJid, property, teks);
    return sock.sendMessage(
      remoteJid,
      {
        text: `✅ _Pesan saat grup di${labelAksi} berhasil diatur menjadi:_\n\n${teks}`,
      },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error set open/close:", error);
    return sock.sendMessage(
      remoteJid,
      { text: "⚠️ Terjadi kesalahan saat menyimpan pengaturan." },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["setopen", "setclose"],
  OnlyPremium: false,
  OnlyOwner: false,
};
