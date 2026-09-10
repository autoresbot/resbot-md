import { groupFetchAllParticipating } from "../../lib/cache.js";

async function formatGrup(sock, index, grup) {
  try {
    const inviteCode = await sock.groupInviteCode(grup.id);
    const groupLink = `https://chat.whatsapp.com/${inviteCode}`;
    return `╭─「 ${index} 」 *${grup.subject}*
│ Anggota : ${grup.participants.length}
│ ID Grup : ${grup.id}
│ Link    : ${groupLink}
╰────────────────────────`;
  } catch (error) {
    return `╭─「 ${index} 」 *${grup.subject}*
│ Anggota : ${grup.participants.length}
│ ID Grup : ${grup.id}
╰────────────────────────`;
  }
  // │ Status : ${grup.announce ? 'Tertutup' : 'Terbuka'}
  // │ Admin : ${grup.restrict ? 'admin' : 'bukan admin'}
}

async function handle(sock, messageInfo) {
  const { remoteJid, message } = messageInfo;

  try {
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });
    const allGroups = await groupFetchAllParticipating(sock);

    const sortedGroups = Object.values(allGroups).sort(
      (a, b) => b.participants.length - a.participants.length
    );

    const formattedGroups = await Promise.all(
      sortedGroups.map((group, index) => formatGrup(sock, index + 1, group))
    );

    const totalGroups = sortedGroups.length;
    const responseMessage = `_*Total Grup: ${totalGroups}*_ \n\n${formattedGroups.join(
      "\n\n"
    )}`;

    // Kirimkan pesan daftar grup
    await sock.sendMessage(
      remoteJid,
      { text: responseMessage },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error in handle function:", error);
    await sock.sendMessage(
      remoteJid,
      { text: "_Terjadi kesalahan saat memproses perintah._" },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["listgc", "listgrub", "listgroub", "listgrup", "listgroup"],
  OnlyPremium: false,
  OnlyOwner: true,
};
