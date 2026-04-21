async function handle(sock, messageInfo) {
  try {
    const { isGroup } = messageInfo;
    if (!isGroup) return; // Hanya untuk grup

    await joinGiveaway(sock, messageInfo);
  } catch (err) {
    console.error("Error in handle:", err);
  }
}

async function joinGiveaway(sock, messageInfo) {
  try {
    const { remoteJid, isGroup, message, sender } = messageInfo;
    if (!isGroup) return; // Hanya bisa di grup

    // Pastikan global.giveawayParticipants terinisialisasi
    if (!global.giveawayParticipants) global.giveawayParticipants = {};
    if (!global.giveawayParticipants[remoteJid]) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `⚠ Giveaway belum dimulai! Admin dapat memulai dengan perintah *.giveaway*`,
        },
        { quoted: message }
      );
      return;
    }

    // Pastikan set ada
    const participants = global.giveawayParticipants[remoteJid];
    if (!(participants instanceof Set)) {
      global.giveawayParticipants[remoteJid] = new Set();
    }

    if (global.giveawayParticipants[remoteJid].has(sender)) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `⚠ @${
            sender.split("@")[0]
          }, kamu sudah bergabung dalam giveaway!`,
        },
        { quoted: message, mentions: [sender] }
      );
      return;
    }

    global.giveawayParticipants[remoteJid].add(sender);
    await sock.sendMessage(
      remoteJid,
      {
        text: `✅ @${sender.split("@")[0]} telah bergabung dalam giveaway!`,
      },
      { quoted: message, mentions: [sender] }
    );
  } catch (err) {
    console.error("Error in joinGiveaway:", err);
  }
}

export default {
  handle,
  Commands: ["ikut"],
  OnlyPremium: false,
  OnlyOwner: false,
};
