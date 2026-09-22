import { findAbsen, pesertaSudahAbsen } from "../../lib/absen.js";
import { sendMessageWithMention } from "../../lib/utils.js";
import mess from "../../strings.js";
import { getGroupMetadata, pesertaAdalahAdmin } from "../../lib/cache.js";
import { isOwner } from "../../lib/users.js";

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender, senderLid, senderType } = messageInfo;
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

    const participants = groupMetadata.participants;

    // Lihat catatan di list absen.js: pola lama (p.id === sender) menolak
    // admin asli di grup ber-alamat LID.
    const isAdmin = pesertaAdalahAdmin(participants, sender, senderLid) || isOwner(senderLid);

    if (!isAdmin) {
      await sock.sendMessage(
        remoteJid,
        { text: mess.general.isAdmin },
        { quoted: message }
      );
      return;
    }

    // Ambil data absen
    const data = await findAbsen(remoteJid);
    const members = data?.member || [];

    // Dicocokkan lewat nomor: absen lama tersimpan sebagai nomor HP sedangkan
    // peserta grup dikenali lewat LID — dibandingkan mentah, orang yang sudah
    // absen tetap ikut terdaftar di sini.
    const belumAbsen = participants.filter((p) => !pesertaSudahAbsen(members, p));

    const noAbsenMembers = belumAbsen.map(
      (p, index) => `${index + 1}. @${(p.id || p.phoneNumber).split("@")[0]}`
    );

    const mentionList = belumAbsen
      .map((p) => p.id || p.phoneNumber)
      .filter((jid) => typeof jid === "string");

    let textNotif;
    if (noAbsenMembers.length > 0) {
      textNotif =
        `📋 *Daftar Yang Belum Absen:*\n\n${noAbsenMembers.join("\n")}\n\n` +
        `⏳ *${noAbsenMembers.length} orang belum absen hari ini.*`;
    } else {
      textNotif = "✅ Semua anggota sudah absen hari ini.";
    }

    await sendMessageWithMention(sock, remoteJid, textNotif, message, senderType, {
      mentions: mentionList,
    });
  } catch (error) {
    console.error("Error handling listnoabsen:", error);
    await sock.sendMessage(
      remoteJid,
      {
        text: "⚠️ Terjadi kesalahan saat menampilkan daftar yang belum absen.",
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["listnoabsen"],
  OnlyPremium: false,
  OnlyOwner: false,
};
