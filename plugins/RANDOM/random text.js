import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;
import config from "../../config.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, command } = messageInfo;
  try {
    let commands = command;
    if (commands == "quote" || commands == "quotes") {
      commands = "randomquote";
    }

    const api = new ApiAutoresbot(config.APIKEY);
    const response = await api.get(`/api/random/${commands}`);

    await sock.sendMessage(
      remoteJid,
      { text: response.data },
      { quoted: message }
    );
  } catch (error) {
    await sock.sendMessage(
      remoteJid,
      {
        text: `_⚠️ Gagal: Periksa Apikey Anda! (.apikey)_`,
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: [
    "animequotes",
    "bucinquote",
    "dilanquote",
    "faktaunik",
    "jawaquote",
    "jokes",
    "pantun",
    "quote",
    "quotes",
    "randomquote",
  ],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
