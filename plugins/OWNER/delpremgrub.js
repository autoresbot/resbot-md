import { findUser, updateUser } from "../../lib/users.js";
import { sendMessageWithMention } from "../../lib/utils.js";
import { getGroupMetadata } from "../../lib/cache.js";

let inProccess = false;

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command, senderType } =
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

    // Validasi input
    if (!content || !content.includes("chat.whatsapp.com")) {
      const tex = `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ \n_*${
        prefix + command
      }*_ https://chat.whatsapp.com/xxx`;
      return await sock.sendMessage(
        remoteJid,
        { text: tex },
        { quoted: message }
      );
    }

    inProccess = true;

    await sock.sendMessage(remoteJid, {
      react: { text: "🧹", key: message.key },
    });

    const idFromGc = content.split("https://chat.whatsapp.com/")[1];

    const res = await sock.query({
      tag: "iq",
      attrs: { type: "get", xmlns: "w:g2", to: "@g.us" },
      content: [{ tag: "invite", attrs: { code: idFromGc } }],
    });

    if (!res.content[0]?.attrs?.id) {
      const tex = `⚠️ _Link Grup tidak valid atau pastikan bot sudah bergabung_`;
      inProccess = false;
      return await sock.sendMessage(
        remoteJid,
        { text: tex },
        { quoted: message }
      );
    }

    const groupId = res.content[0].attrs.id + "@g.us";

    const groupMetadata = await getGroupMetadata(sock, groupId);
    const participants = groupMetadata.participants;

    let successCount = 0;
    let failedCount = 0;
  

    for (const member of participants) {
      try {
        const id_users = member.id;
        let dataUsers = await findUser(id_users);
        if (!dataUsers) continue;
        const [docId, userData] = dataUsers;

        if (userData && userData.premium) {
          userData.premium = null; // Hapus masa premium
          await updateUser(id_users, userData);
          successCount++;
        }
      } catch (error) {
        console.error(`Gagal menghapus premium untuk ${member.id}:`, error);
        failedCount++;
      }
    }

    inProccess = false;

    const responseText = `✅ Berhasil menghapus premium dari ${successCount} pengguna.\n❌ Gagal: ${failedCount}`;
    await sendMessageWithMention(
      sock,
      remoteJid,
      responseText,
      message,
      senderType
    );
  } catch (error) {
    console.error("Error during premium removal:", error);
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
  Commands: ["delpremgrub", "delpremiumgrub"],
  OnlyPremium: false,
  OnlyOwner: true,
};
