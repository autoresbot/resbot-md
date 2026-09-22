import { findAbsen, pesertaSudahAbsen } from "../../lib/absen.js";
import { sendMessageWithMention } from "../../lib/utils.js";
import mess from "../../strings.js";
import { getGroupMetadata, pesertaAdalahAdmin } from "../../lib/cache.js";
import { isOwner } from "../../lib/users.js";

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender, senderLid, senderType } = messageInfo;
  if (!isGroup) return; // Only Grub

  try {
    // Mendapatkan metadata grup
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
    const totalMembers = participants.length;

    // pesertaAdalahAdmin mencocokkan lewat SEMUA bentuk identitas: pola lama
    // (p.id === sender) selalu meleset di grup ber-alamat LID sehingga admin
    // asli pun ditolak dengan pesan "khusus admin".
    const isAdmin = pesertaAdalahAdmin(participants, sender, senderLid) || isOwner(senderLid);

    if (!isAdmin) {
      await sock.sendMessage(
        remoteJid,
        { text: mess.general.isAdmin },
        { quoted: message }
      );
      return;
    }

    // Ambil data absen untuk grup yang sesuai
    const data = await findAbsen(remoteJid);
    const members = data?.member || [];

    // Tag memakai identitas dari data grup supaya mention-nya benar walau
    // absennya tersimpan dalam bentuk nomor HP (data lama).
    const sudah = participants.filter((p) => pesertaSudahAbsen(members, p));

    let textNotif;
    if (sudah.length > 0) {
      const memberList = sudah
        .map((p, index) => `${index + 1}. @${(p.id || p.phoneNumber).split("@")[0]}`)
        .join("\n");

      textNotif =
        `📋 *Daftar Absen Hari Ini:*\n\n${memberList}\n\n` +
        `✔️ *${sudah.length} orang telah absen.*\n` +
        `⏳ *Tersisa ${totalMembers - sudah.length} orang yang belum absen.*`;
    } else {
      textNotif =
        "⚠️ Belum ada yang absen hari ini.\n" +
        `⏳ *Tersisa ${totalMembers} orang yang belum absen.*`;
    }

    // Kirim pesan dengan mention
    await sendMessageWithMention(
      sock,
      remoteJid,
      textNotif,
      message,
      senderType
    );
  } catch (error) {
    console.error("Error handling listabsen:", error);
    await sock.sendMessage(
      remoteJid,
      { text: "⚠️ Terjadi kesalahan saat menampilkan daftar absen." },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["listabsen"],
  OnlyPremium: false,
  OnlyOwner: false,
};
