import { findUser, updateUser, registerUser } from "../../lib/users.js";
import { sendMessageWithMention } from "../../lib/utils.js";
import { getGroupMetadata } from "../../lib/cache.js";



let inProccess = false;

async function handle(sock, messageInfo) {
  const { remoteJid, message, sender, content, prefix, command, senderType } =
    messageInfo;

  try {
    if (inProccess) {
      await sendMessageWithMention(
        sock,
        remoteJid,
        `_Proses sedang berlangsung, silakan tunggu hingga selesai_`,
        message,
        senderType
      );
      return;
    }

    // ✅ Validasi input
    if (!content || content.trim() === "") {
      const tex = `_⚠️ Format Penggunaan:_ \n\n💬 Contoh:\n*${prefix + command}* https://chat.whatsapp.com/xxx 30`;
      return await sock.sendMessage(remoteJid, { text: tex }, { quoted: message });
    }

    let [linkgrub, jumlahHariPremium] = content.split(" ");

    if (!linkgrub.includes("chat.whatsapp.com") || isNaN(jumlahHariPremium)) {
      const tex = `⚠️ _Pastikan format yang benar:_\n${prefix + command} https://chat.whatsapp.com/xxx 30`;
      return await sock.sendMessage(remoteJid, { text: tex }, { quoted: message });
    }

    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    inProccess = true;
    jumlahHariPremium = parseInt(jumlahHariPremium);

    const idFromGc = linkgrub.split("https://chat.whatsapp.com/")[1];

    const res = await sock.query({
      tag: "iq",
      attrs: { type: "get", xmlns: "w:g2", to: "@g.us" },
      content: [{ tag: "invite", attrs: { code: idFromGc } }],
    });

    if (!res.content[0]?.attrs?.id) {
      const tex = `⚠️ _Link grup tidak valid atau pastikan bot sudah bergabung_`;
      await sock.sendMessage(remoteJid, { text: tex }, { quoted: message });
      inProccess = false;
      return;
    }

    const groupId = res.content[0].attrs.id + "@g.us";

    // ✅ Ambil metadata grup
    const groupMetadata = await getGroupMetadata(sock, groupId);
    const participants = groupMetadata?.participants || [];

    let successCount = 0;
    let failedCount = 0;

    for (const member of participants) {
      try {
        // ✅ Ambil JID valid: prioritas phoneNumber, fallback ke id
        const id_users = member.phoneNumber || member.id;

        if (typeof id_users !== "string") {
          console.warn("Skip participant tanpa ID valid:", member);
          failedCount++;
          continue;
        }

        // Ambil data pengguna
        let dataUsers = await findUser(id_users);

        // Hitung tanggal premium baru
        const currentDate = new Date();
        currentDate.setDate(currentDate.getDate() + jumlahHariPremium);

        if (!dataUsers) {
          console.warn(`User belum terdaftar: ${id_users}, coba daftarkan`);

           const username = `user_${id_users.toLowerCase()}`;
           const res = registerUser(id_users, username);
           dataUsers = await findUser(id_users);


          // failedCount++;
          // continue;
        }

        const [docId, userData] = dataUsers;

        userData.premium = currentDate.toISOString();
        await updateUser(id_users, userData);

        successCount++;
      } catch (error) {
        console.error(`Gagal menambahkan premium untuk member:`, error);
        failedCount++;
      }
    }

    inProccess = false;

    const responseText = `✅ Berhasil menambahkan *${successCount}* pengguna ke member premium.\n❌ Gagal: *${failedCount}*`;
    await sendMessageWithMention(sock, remoteJid, responseText, message, senderType);
  } catch (error) {
    console.error("Error processing premium addition:", error);
    inProccess = false;
    await sock.sendMessage(
      remoteJid,
      { text: "❌ Terjadi kesalahan saat memproses data." },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["addpremgrub", "addpremiumgrub"],
  OnlyPremium: false,
  OnlyOwner: true, // Hanya owner yang bisa akses
};
