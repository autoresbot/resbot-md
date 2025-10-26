import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;
import config from "../../config.js";
import mess from "../../strings.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, command } = messageInfo;
  try {
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const api = new ApiAutoresbot(config.APIKEY);
    const buffer = await api.getBuffer(`/api/random/${command}`);

    await sock.sendMessage(
      remoteJid,
      { image: buffer, caption: mess.general.success },
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
    "aesthetic",
    "cecan",
    "cogan",
    "cosplay",
    "darkjoke",
    "hacker",
    "kucing",
    "memeindo",
    "motivasi",
    "thailand",
    "vietnam",
    "walhp",
  ],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
