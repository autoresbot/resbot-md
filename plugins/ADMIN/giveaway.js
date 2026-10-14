import mess from "../../strings.js";
import { getGroupMetadata } from "../../lib/cache.js";

global.giveawayParticipants = global.giveawayParticipants || {};

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, sender, content, prefix, command } =
    messageInfo;
  if (!isGroup) return;

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

  // Mulai Giveaway
  if (command === "giveaway") {
    if (!global.giveawayParticipants[remoteJid]) {
      global.giveawayParticipants[remoteJid] = new Set();
    }
    await sock.sendMessage(
      remoteJid,
      {
        text: `🎉 *GIVEAWAY DIMULAI!* 🎉\n\nKetik *.ikut* untuk bergabung.\n\nGunakan *.mulaigiveaway <jumlah_pemenang>* untuk mengacak pemenang.`,
      },
      { quoted: message }
    );
    return;
  }

  // Lihat daftar peserta giveaway
  if (command === "listgiveaway") {
    const peserta = global.giveawayParticipants[remoteJid];
    if (!peserta) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `⚠ Give away belum dimulai. ketik *${prefix}giveaway* untuk memulai`,
        },
        { quoted: message }
      );
      return;
    }

    const daftar = Array.from(peserta);
    if (daftar.length === 0) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `📋 *PESERTA GIVEAWAY*\n\n_Belum ada peserta._\nKetik *${prefix}ikut* untuk bergabung.`,
        },
        { quoted: message }
      );
      return;
    }

    const baris = daftar
      .map((jid, i) => `${i + 1}. @${jid.split("@")[0]}`)
      .join("\n");
    await sock.sendMessage(
      remoteJid,
      {
        text: `📋 *PESERTA GIVEAWAY*\n\n${baris}\n\n_Total: ${daftar.length} peserta_\nGunakan *${prefix}mulaigiveaway <jumlah_pemenang>* untuk mengacak pemenang.`,
        mentions: daftar,
      },
      { quoted: message }
    );
    return;
  }

  // Mulai Pengacakan Giveaway
  if (command === "mulaigiveaway") {
    if (!global.giveawayParticipants[remoteJid]) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `⚠ Give away belum dimulai. ketik *.giveaway* untuk memulai`,
        },
        { quoted: message }
      );
      return;
    }

    if (!content || isNaN(content) || parseInt(content) <= 0) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `⚠ Gunakan format: *.mulaigiveaway <jumlah_pemenang>*`,
        },
        { quoted: message }
      );
      return;
    }

    const jumlahPemenang = parseInt(content);
    await startGiveaway(sock, remoteJid, message, jumlahPemenang);
  }
}

async function startGiveaway(sock, remoteJid, message, jumlahPemenang) {
  if (
    !global.giveawayParticipants[remoteJid] ||
    global.giveawayParticipants[remoteJid].size === 0
  ) {
    await sock.sendMessage(
      remoteJid,
      {
        text: `❌ Tidak ada peserta yang ikut dalam giveaway!`,
      },
      { quoted: message }
    );
    return;
  }

  const participantsArray = Array.from(global.giveawayParticipants[remoteJid]);

  if (jumlahPemenang > participantsArray.length) {
    await sock.sendMessage(
      remoteJid,
      {
        text: `⚠ Total peserta yang ikut : ${participantsArray.length}`,
      },
      { quoted: message }
    );
    return;
  }

  // Mengacak pemenang secara acak
  const shuffled = participantsArray.sort(() => 0.5 - Math.random());
  const winners = shuffled.slice(0, jumlahPemenang);

  const winnerMentions = winners
    .map((winner) => `◧ @${winner.split("@")[0]}`)
    .join("\n");
  await sock.sendMessage(
    remoteJid,
    {
      text: `🎉 *Pemenang Giveaway:* 🎉\n\n${winnerMentions}`,
      mentions: winners,
    },
    { quoted: message }
  );

  // Reset peserta setelah giveaway selesai
  delete global.giveawayParticipants[remoteJid];
}

export default {
  handle,
  Commands: ["giveaway", "mulaigiveaway", "listgiveaway"],
  // Tiga fitur berbeda, bukan alias.
  MenuCommands: "all",
  OnlyPremium: false,
  OnlyOwner: false,
};
