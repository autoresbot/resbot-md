const { sendMessageWithMention } = require("@lib/utils");
const { readUsers } = require("@lib/users");
const { getGroupMetadata } = require("@lib/cache");
const mess = require("@mess");

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender, senderType } = messageInfo;
  if (!isGroup) return; // Only Grub

  try {
    // Mendapatkan metadata grup
    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    const participants = groupMetadata.participants;
    const isAdmin = participants.some(
      (participant) => participant.id === sender && participant.admin
    );
    if (!isAdmin) {
      await sock.sendMessage(
        remoteJid,
        { text: mess.general.isAdmin },
        { quoted: message }
      );
      return;
    }

    // Baca data user dari database atau file
    const dataUsers = await readUsers();

    const aliasList = Object.entries(dataUsers)
      .map(([id, user]) => {
        if (
          !user.aliases ||
          !Array.isArray(user.aliases) ||
          user.aliases.length === 0
        )
          return null;

        let alias;

        if (senderType === "user") {
          // Cari alias dengan akhiran @s.whatsapp.net
          alias = user.aliases.find((a) => a.endsWith("@s.whatsapp.net"));
          if (!alias) return null; // Jika tidak ditemukan, skip user
          alias = alias.split("@")[0]; // Ambil nomor sebelum @
        } else {
          // Ambil alias yang TIDAK mengandung @s.whatsapp.net (misal alias manual)
          alias = user.aliases.find((a) => a.endsWith("@lid"));
          if (!alias) return null; // Jika tidak ditemukan, skip user
          alias = alias.split("@")[0]; // Ambil nomor sebelum @
        }

        return `┣ ⌬ ${user.username} - 💰 Money: ${user.money}`;
      })
      .filter(Boolean)
      .join("\n");
    const textNotif = `┏━『 *TOP 10 MEMBER* 』\n┣\n${aliasList}\n┗━━━━━━━━━━━━━━━`;

    // Kirim pesan dengan mention
    await sendMessageWithMention(
      sock,
      remoteJid,
      textNotif,
      message,
      senderType
    );
  } catch (error) {
    console.error("Error in handle:", error);
    // Tangani error dan kirim pesan
    await sock.sendMessage(
      remoteJid,
      { text: "⚠️ Terjadi kesalahan saat menampilkan daftar pengguna." },
      { quoted: message }
    );
  }
}

module.exports = {
  handle,
  Commands: ["top"],
  OnlyPremium: false,
  OnlyOwner: false,
};
