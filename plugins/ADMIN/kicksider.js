import mess from "../../strings.js";
import config from "../../config.js";
import { getActiveUsers } from "../../lib/users.js";
import { sendMessageWithMention } from "../../lib/utils.js";
import { getGroupMetadata } from "../../lib/cache.js";

const TOTAL_HARI_SIDER = 30; // total hari maksimum dianggap tidak aktif
const DELAY_KICK = 3000;

let inProccess = false;

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender, content, senderType } =
    messageInfo;
  if (!isGroup) return;

  try {
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

    if (inProccess) {
      await sendMessageWithMention(
        sock,
        remoteJid,
        `_Proses pembersihan member sider sedang berlangsung, silakan tunggu hingga selesai_`,
        message,
        senderType
      );
      return;
    }

    const listNotSider = await getActiveUsers(TOTAL_HARI_SIDER);

    const memberList = participants
      .filter((p) => !listNotSider.some((active) => active.id === p.id))
      .map((p) => p.id);

    const countSider = memberList.length;
    const totalMember = participants.length;

    if (countSider === 0) {
      return await sock.sendMessage(
        remoteJid,
        { text: "📋 _Tidak ada member sider di grup ini._" },
        { quoted: message }
      );
    }

    const input = content.toLowerCase().trim();

    // Tangani jika input .kicksider all atau angka
    if (input === "all" || (!isNaN(input) && Number(input) > 0)) {
      const jumlahKick =
        input === "all"
          ? memberList.length
          : Math.min(Number(input), memberList.length);

      await sock.sendMessage(remoteJid, {
        react: { text: "⏰", key: message.key },
      });
      inProccess = true;

      let successCount = 0;
      let failedCount = 0;
      for (const [index, member] of memberList.entries()) {
        if (index >= jumlahKick) break;

        await new Promise((resolve) => setTimeout(resolve, DELAY_KICK));

        // Ambil nomor saja sebelum @
        const memberNumber = member.split("@")[0];

        if (memberNumber === config.phone_number_bot) continue;

        try {
          await sock.groupParticipantsUpdate(remoteJid, [member], "remove");
          successCount++;
        } catch (error) {
          failedCount++;
        }
      }

      inProccess = false;

      if (successCount === jumlahKick) {
        await sendMessageWithMention(
          sock,
          remoteJid,
          `_Berhasil mengeluarkan ${successCount} member sider_`,
          message,
          senderType
        );
      } else {
        await sendMessageWithMention(
          sock,
          remoteJid,
          `_Berhasil mengeluarkan ${successCount} dari ${jumlahKick} member sider_`,
          message,
          senderType
        );
      }

      return;
    }

    // Default info saat hanya ketik .kicksider tanpa argumen valid
    await sendMessageWithMention(
      sock,
      remoteJid,
      `_Total Sider *${countSider}* dari ${totalMember}_\n\n_Untuk melanjutkan kick member sider, ketik:_\n• *.kicksider all* — untuk keluarkan semua\n• *.kicksider <jumlah>* — untuk keluarkan sebagian\n\nContoh: *.kicksider 5*`,
      message,
      senderType
    );
  } catch (error) {
    console.error("Error handling kick sider command:", error);
    return await sock.sendMessage(
      remoteJid,
      { text: "Terjadi kesalahan saat memproses permintaan Anda." },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["kicksider"],
  OnlyPremium: false,
  OnlyOwner: false,
};
