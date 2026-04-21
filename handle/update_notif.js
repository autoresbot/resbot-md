const respondedSenders = new Set();
import { getGreeting } from "../lib/utils.js";
import { isOwner } from "../lib/users.js";
import axios from "axios";

const version = global.version;
const serverUrl = `https://api.autoresbot.com/api/updates/resbot?version=${version}`; // Ganti dengan URL server Anda

async function checkUpdate() {
  try {
    const response = await axios.get(serverUrl);
    const data = response.data;
    return data;
  } catch (error) {
    return null;
  }
}

async function process(sock, messageInfo) {
  const { remoteJid, sender, message, pushName, fullText } = messageInfo;

  const salam = getGreeting();
  if (pushName == "Unknown") return true;
  if (!fullText) return true;

  if (respondedSenders.has("notif_update")) return;

  const isOwnerUsers = isOwner(sender);
  if (!isOwnerUsers) return;

  const result = await checkUpdate();

  if (!result) {
    // jika api bermasalah
    respondedSenders.add("notif_update");
    return true;
  }

  if (
    result.code == 200 &&
    result.message == "Anda sudah menggunakan versi terbaru."
  ) {
    respondedSenders.add("notif_update");
    return true;
  }
  const response = `👋 _${salam}_ Owner! \n\n✨ Versi terbaru script sudah tersedia! ✨\nKetik *.update -y* untuk langsung memperbaruinya 🚀

atau ketik *.updateforce* untuk memperbarui semua yang tersedia`;

  try {
    // Kirim pesan balasan ke pengirim
    await sock.sendMessage(remoteJid, { text: response }, { quoted: message });

    // Tandai pengirim sebagai sudah diberi respons
    respondedSenders.add("notif_update");
    return false;
  } catch (error) {
    console.error("Error in notifikasi update process:", error);
  }

  return true;
}

export default {
  name: "Notifikasi Update",
  priority: 7,
  process,
};
