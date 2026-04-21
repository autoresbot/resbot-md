import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";

async function handle(sock, messageInfo) {
  const remoteJid = messageInfo.remoteJid;
  const message = messageInfo.message;

  const api = new ApiAutoresbot(config.APIKEY);
  const response = await api.get("/api/database/tutorial");

  if (response && response.data) {
    let messageText = "╭「 Tutorial Seputar Bot 」\n\n";
    response.data.forEach((item, index) => {
      messageText += `◧ *${item.title}*\n`;
      messageText += `◧ ${item.link}\n\n`;
    });
    messageText += `╰─────◧`;
    await sock.sendMessage(
      remoteJid,
      { text: messageText },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["tutor", "tutorial"],
  OnlyPremium: false,
  OnlyOwner: false,
};
