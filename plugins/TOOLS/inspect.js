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

    // Melakukan query untuk mendapatkan informasi grup
    const response = await sock.query({
      tag: "iq",
      attrs: {
        type: "get",
        xmlns: "w:g2",
        to: "@g.us",
      },
      content: [{ tag: "invite", attrs: { code: inviteCode } }],
    });

    const groupInfo = response.content[0]?.attrs || {};
    const groupDetails = `「 _*Group Link Yang Di Inspect*_ 」\n\n◧ Name : ${
      groupInfo.subject || "undefined"
    }\n◧ Desc : ${
      groupInfo.s_t
        ? moment(groupInfo.s_t * 1000)
            .tz("Asia/Jakarta")
            .format("DD-MM-YYYY, HH:mm:ss")
        : "undefined"
    }\n◧ Owner : ${
      groupInfo.creator ? "@" + groupInfo.creator.split("@")[0] : "undefined"
    }\n◧ Created : ${
      groupInfo.creation
        ? moment(groupInfo.creation * 1000)
            .tz("Asia/Jakarta")
            .format("DD-MM-YYYY, HH:mm:ss")
        : "undefined"
    }\n◧ Size : ${groupInfo.size || "undefined"} Member\n◧ ID : ${
      groupInfo.id || "undefined"
    }`;
    // Mendapatkan foto profil grup
    let ppUrl = null;
    try {
      ppUrl = await sock.profilePictureUrl(`${groupInfo.id}@g.us`, "image");
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
