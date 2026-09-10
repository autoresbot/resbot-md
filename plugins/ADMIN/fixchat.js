import mess from "../../strings.js";
import { getGroupMetadata } from "../../lib/cache.js";

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender } = messageInfo;

  if (!isGroup) {
    // Hanya untuk grup
    await sock.sendMessage(
      remoteJid,
      { text: mess.general.isGroup },
      { quoted: message }
    );
    return;
  }

  // Mendapatkan metadata grup
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

  try {
    const participantIds = participants.map((p) => p.id);

    await sock.sendMessage(remoteJid, {
      text: `✅ Grup *${groupMetadata.subject}* telah diperbaiki!\nPeserta: ${participantIds.length} anggota.`,
      mentions: participantIds,
    });

    // Jika ingin menghapus pesan tertentu dari chat (clear), pastikan `message` memiliki `key`
    if (message && message.key && message.key.id) {
      await sock.chatModify(
        {
          clear: {
            messages: [{ id: message.key.id, fromMe: message.key.fromMe }],
          },
        },
        remoteJid
      );
    }

    await sock.sendMessage(
      remoteJid,
      { text: "✔️ Fix chat berhasil!" },
      { quoted: message }
    );
  } catch (err) {
    console.error("Terjadi kesalahan saat fix chat:", err);
    await sock.sendMessage(
      remoteJid,
      { text: "❌ Gagal memperbaiki chat!" },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["fixchat"],
  OnlyPremium: false,
  OnlyOwner: false,
};
