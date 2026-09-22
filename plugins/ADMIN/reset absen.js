import { resetAbsen } from "../../lib/absen.js";
import mess from "../../strings.js";
import { getGroupMetadata, pesertaAdalahAdmin } from "../../lib/cache.js";
import { isOwner } from "../../lib/users.js";

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender, senderLid, prefix, command } = messageInfo;
  if (!isGroup) return; // Only Grub

  try {
    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    if (!groupMetadata?.participants) {
      await sock.sendMessage(
        remoteJid,
        { text: "⚠️ _Gagal mengambil data grup, coba lagi beberapa saat._" },
        { quoted: message }
      );
      return;
    }

    const isAdmin =
      pesertaAdalahAdmin(groupMetadata.participants, sender, senderLid) || isOwner(senderLid);

    if (!isAdmin) {
      await sock.sendMessage(remoteJid, { text: mess.general.isAdmin }, { quoted: message });
      return;
    }

    const jumlah = await resetAbsen(remoteJid);

    await sock.sendMessage(
      remoteJid,
      {
        text:
          jumlah > 0
            ? `♻️ _Absen hari ini berhasil direset._\n\n_*${jumlah}* orang yang tadi sudah absen kini kosong. Ketik *${prefix}absen* untuk mulai absen lagi._`
            : "⚠️ _Belum ada yang absen hari ini, tidak ada yang perlu direset._",
      },
      { quoted: message }
    );
  } catch (error) {
    console.error(`Error handling ${command}:`, error);
    await sock.sendMessage(
      remoteJid,
      { text: "⚠️ Terjadi kesalahan saat mereset absen." },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["resetabsen"],
  OnlyPremium: false,
  OnlyOwner: false,
};
