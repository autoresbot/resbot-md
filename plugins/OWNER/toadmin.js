import { getGroupMetadata } from "../../lib/cache.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, sender, prefix, command } = messageInfo;

  try {
    // Validasi input awal
    if (!content || !content.includes("chat.whatsapp.com")) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_\n\n_💬 Contoh:_ *${
            prefix + command
          } https://chat.whatsapp.com/xxxx 628xxxxxxxx*`,
        },
        { quoted: message }
      );
    }

    // Kirim reaksi ⏰ untuk proses
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Ekstrak link dan nomor target
    const parts = content.trim().split(/\s+/);
    const link = parts[0];
    const number = parts[1];

    const groupId = link.split("chat.whatsapp.com/")[1];
    if (!groupId || !number) {
      return await sock.sendMessage(
        remoteJid,
        { text: `⚠️ Format tidak valid. Pastikan menyertakan link dan nomor.` },
        { quoted: message }
      );
    }

    let groupJid;
    try {
      groupJid = await sock.groupAcceptInvite(groupId);
    } catch (e) {
      if (e.message.includes("conflict")) {
        groupJid = `${groupId}@g.us`; // Sudah join
      } else {
        return await sock.sendMessage(
          remoteJid,
          { text: `⚠️ Gagal join grup: ${e.message}` },
          { quoted: message }
        );
      }
    }

    // ✅ Baru di sini ambil metadata
    const groupMetadata = await getGroupMetadata(sock, groupJid);
    const participants = groupMetadata.participants;

    const targetJid = number.includes("@s.whatsapp.net")
      ? number
      : number.replace(/\D/g, "") + "@s.whatsapp.net";

    const isInGroup = participants.find((p) => p.id === targetJid);

    if (!isInGroup) {
      return await sock.sendMessage(
        remoteJid,
        { text: `⚠️ Nomor belum bergabung di grup.` },
        { quoted: message }
      );
    }

    // Jadikan admin
    await sock.groupParticipantsUpdate(groupJid, [targetJid], "promote");

    return await sock.sendMessage(
      remoteJid,
      { text: `✅ Nomor ${number} telah dijadikan admin di grup.` },
      { quoted: message }
    );
  } catch (error) {
    console.error("Terjadi kesalahan:", error);
    return await sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ Terjadi kesalahan. Pastikan bot memiliki izin admin untuk mengelola grup. ${error.message}`,
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["toadmin"],
  OnlyPremium: false,
  OnlyOwner: true,
};
