const font =
  "𝐚 𝐛 𝐜 𝐝 𝐞 𝐟 𝐠 𝐡 𝐢 𝐣 𝐤 𝐥 𝐦 𝐧 𝐨 𝐩 𝐪 𝐫 𝐬 𝐭 𝐮 𝐯 𝐰 𝐱 𝐲 𝐳 𝟎 𝟏 𝟐 𝟑 𝟒 𝟓 𝟔 𝟕 𝟖 𝟗 𝐀 𝐁 𝐂 𝐃 𝐄 𝐅 𝐆 𝐇 𝐈 𝐉 𝐊 𝐋 𝐌 𝐍 𝐎 𝐏 𝐐 𝐑 𝐒 𝐓 𝐔 𝐕 𝐖 𝐗 𝐘 𝐙";
const commandName = "style5";

import { reply, style } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, prefix, command, content } = messageInfo;

  try {
    if (!content) {
      return await reply(
        m,
        `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
          prefix + command
        } resbot*_`
      );
    }

    const result = style(content, font);
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
  Commands: [commandName],
  OnlyPremium: false,
  OnlyOwner: false,
};
