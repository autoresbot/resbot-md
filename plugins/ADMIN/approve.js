import mess from "../../strings.js";
import { getGroupMetadata } from "../../lib/cache.js";

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender } = messageInfo;

  try {
    if (!isGroup) {
      // Khusus Grup
      await sock.sendMessage(remoteJid, { text: mess.general.isGroup }, { quoted: message });
      return;
    }

    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    const participants = groupMetadata.participants;
     const isAdmin = participants.some(
      (p) => (p.phoneNumber === sender || p.id === sender) && p.admin
    );

    if (!isAdmin) {
       await sock.sendMessage(remoteJid, { text: mess.general.isAdmin }, { quoted: message });
      return;
    }

    const pendingRequests = await sock.groupRequestParticipantsList(remoteJid);
    if (!pendingRequests || !pendingRequests.length) {
      return await sock.sendMessage(
        remoteJid,
        { text: "_❌ No members have requested to join._" },
        { quoted: message }
      );
    }

    for (const member of pendingRequests) {
      await delay(2000);
      await sock.groupRequestParticipantsUpdate(remoteJid, [member.jid], "approve");
    }

    await sock.sendMessage(
      remoteJid,
      { text: "_✅ Successfully accepted all join requests._" },
      { quoted: message }
    );
  } catch (error) {
    console.log(error)
    await sock.sendMessage(
      remoteJid,
      {
        text: "⚠️ Terjadi kesalahan saat mencoba menyetujui permintaan bergabung. Pastikan bot memiliki izin.",
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["approve"],
  OnlyPremium: false,
  OnlyOwner: false,
};
