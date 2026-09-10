import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";
import { logCustom } from "../../lib/logger.js";

import { reply } from "../../lib/utils.js";
import moment from "moment-timezone";

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, content, prefix, command } = messageInfo;

  try {
    // Validasi jika tidak ada konten
    if (!content) {
      return await reply(
        m,
        `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _${
          prefix + command
        } https://chat.whatsapp.com/GtaKoZ3HCB21CG3BF3gmQ3_`
      );
    }

    // Mendapatkan kode undangan dari link
    const inviteCode = content.split("https://chat.whatsapp.com/")[1];
    if (!inviteCode) {
      return await reply(m, "⚠️ _Link Invalid_");
    }

    // Kirim reaksi "⏳" sebagai indikasi sedang memproses
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Dulu di sini dikirim node IQ mentah lalu hasilnya dibaca lewat
    // `response.content[0].attrs`. Bentuk node hasil decode zapo berbeda, jadi
    // semua field terbaca undefined. Sekarang dipakai parser resmi zapo yang
    // mengembalikan objek bertipe — tidak perlu menebak struktur node lagi.
    const groupInfo = (await sock.groupGetInviteInfo(inviteCode)) || {};

    const tanggal = (detik) =>
      detik
        ? moment(detik * 1000)
            .tz("Asia/Jakarta")
            .format("DD-MM-YYYY, HH:mm:ss")
        : "-";

    // `subjectOwner` bisa berbentuk LID; versi nomor teleponnya didahulukan
    // supaya yang tampil nomor asli.
    const owner = groupInfo.subjectOwnerPhoneNumber || groupInfo.subjectOwner;

    const groupDetails =
      `「 _*Group Link Yang Di Inspect*_ 」\n\n` +
      `◧ Name : ${groupInfo.subject || "-"}\n` +
      `◧ Desc : ${groupInfo.desc || "-"}\n` +
      `◧ Owner : ${owner ? "@" + owner.split("@")[0] : "-"}\n` +
      `◧ Created : ${tanggal(groupInfo.creation)}\n` +
      `◧ Size : ${groupInfo.size ?? "-"} Member\n` +
      `◧ ID : ${groupInfo.jid || "-"}`;

    // Mendapatkan foto profil grup
    let ppUrl = null;
    try {
      // `jid` sudah lengkap dengan @g.us, tidak perlu ditambah lagi.
      ppUrl = await sock.profilePictureUrl(groupInfo.jid, "image");
    } catch {
      const api = new ApiAutoresbot(config.APIKEY);
      const apiResponse = await api.get("/api/stalker/whatsapp-group", {
        url: content,
      });

      if (!apiResponse || !apiResponse.data) {
        throw new Error("File upload gagal atau tidak ada URL.");
      }
      ppUrl = apiResponse.data.imageLink;
    }

    // Kirim pesan dengan atau tanpa gambar
    if (ppUrl) {
      await sock.sendMessage(
        remoteJid,
        {
          image: { url: ppUrl },
          caption: groupDetails,
        },
        { quoted: message }
      );
    } else {
      await reply(m, groupDetails);
    }
  } catch (error) {
    console.error("Error saat memproses grup:", error);
    logCustom("info", content, `ERROR-COMMAND-${command}.txt`);

    // Kirim pesan kesalahan
    await sock.sendMessage(
      remoteJid,
      {
        text: "⚠️ Terjadi kesalahan saat mendapatkan info grup. Pastikan format benar dan bot memiliki izin.",
      },
      { quoted: message }
    );
  }
}
export default {
  handle,
  Commands: ["inspect"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
