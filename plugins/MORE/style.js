import { reply, style } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, prefix, command, content } = messageInfo;

  try {
    if (!content) {
      return await reply(
        m,
        `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${prefix + command} resbot*_

ᴄᴏɴᴛᴏʜ ꜱᴛʏʟᴇ
𝓬𝓸𝓷𝓽𝓸𝓱 𝓼𝓽𝔂𝓵𝓮2
contoh style3
ⓒⓞⓝⓣⓞⓗ ⓢⓣⓨⓛⓔ④
𝐜𝐨𝐧𝐭𝐨𝐡 𝐬𝐭𝐲𝐥𝐞𝟓
𝗰𝗼𝗻𝘁𝗼𝗵 𝘀𝘁𝘆𝗹𝗲𝟲
𝘤𝘰𝘯𝘵𝘰𝘩 𝘴𝘵𝘺𝘭𝘦7
𝙘𝙤𝙣𝙩𝙤𝙝 𝙨𝙩𝙮𝙡𝙚8
🄲🄾🄽🅃🄾🄷 🅂🅃🅈🄻🄴9
🅲🅾️🅽🆃🅾️🅷 🆂🆃🆈🅻🅴10
                
_Gunakan .style2 sampai .style10_`
      );
    }

    const result = style(content);
    if (!result) {
      return await reply(
        m,
        "⚠️ _Failed to apply style. Please check your input._"
      );
    }

    await sock.sendMessage(remoteJid, { text: result }, { quoted: message });
  } catch (error) {
    console.error("Error in handle function:", error);
    await sock.sendMessage(
      remoteJid,
      { text: `_Error: ${error.message}_` },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["style"],
  OnlyPremium: false,
  OnlyOwner: false,
};
