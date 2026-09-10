import { readUsers } from "../../lib/users.js";
import { sendMessageWithMention } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, senderType } = messageInfo;

  try {
    const users = await readUsers();

    // Ambil hanya pengguna yang memiliki atribut premium dan tanggalnya masih berlaku
    const premiumUsers = Object.entries(users)
      .filter(
        ([docId, userData]) =>
          userData.premium && new Date(userData.premium) > new Date()
      )
      .map(([docId, userData]) => ({
        docId,
        username: userData.username,
        premium: userData.premium,
        aliases: userData.aliases,
      }));

    if (premiumUsers.length === 0) {
      return await sock.sendMessage(
        remoteJid,
        { text: "⚠️ Tidak ada pengguna yang premium saat ini." },
        { quoted: message }
      );
    }

    // Buang domain APA PUN, bukan cuma @s.whatsapp.net. Alias sekarang banyak
    // yang berbentuk @lid; kalau domainnya tersisa, teks jadi "@123@lid" dan
    // `@lid` ikut terbaca sebagai mention kedua yang tidak sah.
    function cleanJid(jid) {
      return String(jid ?? "").split("@")[0];
    }

    // JID alias dipakai APA ADANYA sebagai mention. Domainnya (@lid atau
    // @s.whatsapp.net) berbeda-beda per user dan tidak boleh ditebak dari
    // senderType — itu tipe pengirim perintah, bukan tipe orang yang di-tag.
    const mentions = premiumUsers.map((user) => user.aliases?.[0]).filter(Boolean);

    // Format daftar pengguna premium pakai username
   const premiumList = premiumUsers
  .map((user, index) => {
    const uname = cleanJid(user.aliases?.[0]);
    return `◧ *@${uname}* (Premium hingga: ${new Date(
      user.premium
    ).toLocaleDateString()})`;
  })
  .join("\n");

    const textNotif = `📋 *LIST PREMIUM:*\n\n${premiumList}\n\n_Total:_ *${premiumUsers.length}*`;

    // Kirim pesan (tidak perlu mention, atau jika mau mention ambil dari aliases)
    await sendMessageWithMention(
      sock,
      remoteJid,
      textNotif,
      message,
      senderType,
      mentions
    );
  } catch (error) {
    console.error("Error fetching users:", error);
    await sock.sendMessage(
      remoteJid,
      { text: "Terjadi kesalahan saat memproses data pengguna." },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["listprem", "listpremium"],
  OnlyPremium: false,
  OnlyOwner: true,
};
