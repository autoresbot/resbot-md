import mess from "../../strings.js";
import { getTotalChatPerGroup } from "../../lib/totalchat.js";
import { sendMessageWithMention } from "../../lib/utils.js";
import { getGroupMetadata, nomorDari } from "../../lib/cache.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, sender, isGroup, senderType } = messageInfo;
  if (!isGroup) return; // Hanya untuk grup

  try {
    // ✅ Ambil metadata grup
    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    const participants = groupMetadata?.participants || [];

    // ✅ Cek apakah pengirim admin (pakai phoneNumber atau id)
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

    // ✅ Ambil total chat per grup
    const totalChatData = await getTotalChatPerGroup(remoteJid);

    // ✅ Gabungkan data peserta dengan total chat mereka.
    // totalChatData berkunci NOMOR telanjang (lihat lib/totalchat.js). Satu
    // peserta bisa punya beberapa identitas (phoneNumber / id / jid / lid) —
    // semuanya dinormalkan lalu dijumlahkan supaya cocok dengan baris chat yang
    // tersimpan baik di bawah nomor telepon maupun LID.
    const chatWithParticipants = participants.map((participant) => {
      const jid = participant.phoneNumber || participant.id; // untuk mention/tampilan
      const nomorUnik = [
        ...new Set(
          [participant.phoneNumber, participant.id, participant.jid, participant.lid]
            .map(nomorDari)
            .filter(Boolean)
        ),
      ];
      const totalChat = nomorUnik.reduce((sum, n) => sum + (totalChatData[n] || 0), 0);
      return { jid, totalChat };
    });

    if (chatWithParticipants.length === 0) {
      return await sock.sendMessage(
        remoteJid,
        { text: "_Belum ada data chat untuk grup ini._" },
        { quoted: message }
      );
    }

    // ✅ Hitung total semua chat
    const totalChatCount = chatWithParticipants.reduce(
      (sum, p) => sum + p.totalChat,
      0
    );

    // ✅ Urutkan berdasarkan jumlah chat
    const sortedMembers = chatWithParticipants.sort(
      (a, b) => b.totalChat - a.totalChat
    );

    // ✅ Format hasil
    let response = `══✪〘 *👥 Total Chat* 〙✪══\n\n`;
    sortedMembers.forEach(({ jid, totalChat }) => {
      const clean = typeof jid === "string" ? jid.split("@")[0] : "unknown";
      response += `◧ @${clean}: ${totalChat} chat\n`;
    });

    response += `\n\n📊 _Total chat di grup ini:_ *${totalChatCount}*`;

    // ✅ Kirim pesan dengan mention
    const mentionList = sortedMembers
      .map((m) => m.jid)
      .filter((j) => typeof j === "string");

    await sendMessageWithMention(sock, remoteJid, response, message, senderType, {
      mentions: mentionList,
    });
  } catch (error) {
    console.error("Error handling total chat command:", error);
    await sock.sendMessage(
      remoteJid,
      { text: "❌ Terjadi kesalahan saat memproses permintaan Anda." },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["totalchat"],
  OnlyPremium: false,
  OnlyOwner: false,
};
