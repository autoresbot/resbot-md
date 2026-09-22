import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";
import { logCustom } from "../../lib/logger.js";

// Negara diambil dari kode region akun
const COUNTRIES = {
  ID: "Indonesia 🇮🇩",
  MY: "Malaysia 🇲🇾",
  PH: "Filipina 🇵🇭",
  SG: "Singapura 🇸🇬",
  TH: "Thailand 🇹🇭",
  VN: "Vietnam 🇻🇳",
  MM: "Myanmar 🇲🇲",
  KH: "Kamboja 🇰🇭",
  BR: "Brasil 🇧🇷",
  RU: "Rusia 🇷🇺",
  US: "Amerika Serikat 🇺🇸",
};

function getCountry(region) {
  if (!region) return "Tidak diketahui";
  return COUNTRIES[String(region).toUpperCase()] || region;
}

// /api/stalker/ml2 kadang mengembalikan user.region = null, padahal
// /api/stalker/ml untuk akun yang sama tetap punya region-nya.
// shop_country/currency sengaja tidak dipakai: itu negara toko top up,
// bukan region akun.
async function getRegion(api, user, user_id, server) {
  if (user.region) return user.region;

  try {
    const fallback = await api.get("/api/stalker/ml", { user_id, server });
    return fallback?.data?.region || null;
  } catch (error) {
    // Negara hanya pelengkap; jangan sampai menggagalkan seluruh hasil
    console.warn("[ML2] Gagal mengambil region dari /api/stalker/ml:", error?.message || error);
    return null;
  }
}

function status(available) {
  return available ? "✅ Tersedia" : "❌ Tidak";
}

// Label disejajarkan supaya tanda ":" lurus
function formatList(items, getLabel) {
  if (!Array.isArray(items) || items.length === 0) return "- Tidak ada data";
  const labels = items.map(getLabel);
  const width = Math.max(...labels.map((label) => label.length));
  return items
    .map((item, i) => `- ${labels[i].padEnd(width)} : ${status(item.available)}`)
    .join("\n");
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, prefix, command, content } = messageInfo;

  try {
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return await sock.sendMessage(
        remoteJid,
        { text: `_Masukkan ID GAME_\n\n${prefix + command} 427679814 9954` },
        { quoted: message }
      );
    }

    const [user_id, server] = trimmedContent.replace(/[()]/g, " ").split(/\s+/);

    if (!user_id || !server) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ _Format salah. Gunakan:_\n\n${
            prefix + command
          } <user_id> <server>`,
        },
        { quoted: message }
      );
    }

    // Mengirimkan reaksi loading
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const api = new ApiAutoresbot(config.APIKEY);

    // Memanggil API
    const response = await api.get("/api/stalker/ml2", { user_id, server });

    if (response?.data?.user) {
      const { user, membership, double_diamond, diamond } = response.data;
      const region = await getRegion(api, user, user_id, server);

      // Hanya paket dalam rentang diamond tertentu yang ditampilkan
      const inRange = (items, min, max) =>
        (items || []).filter(
          (item) => item.diamond_base >= min && item.diamond_base <= max
        );

      const text = `. 𖹭 ⸼“ 𝘀𝘁𝗮𝗹𝗸 𝗱𝗶𝗮𝗺𝗼𝗻𝗱 𝗺𝗹𝗯𝗯 ⊃
  ───┈── ⁺ִ 🐰 ꞌꞋ ࣪──┈───
𖢷 Username : ${user.username || "Tidak diketahui"}
𖢷 ID Server : ${user.id || user_id} (${user.zone || server})
𖢷 Negara : ${getCountry(region)}

🎟️ Membership
${formatList(membership, (item) => item.title.replace(/\s*Bundle$/i, ""))}

💎 Diamond Ganda
${formatList(inRange(double_diamond?.items, 50, 500), (item) => item.title)}

💎 Diamond 1id 1x
${formatList(
  inRange(diamond, 5, 50),
  (item) => `${item.diamond_base}+${item.diamond_base}`
)}`;

      // Mengirimkan data yang diperoleh
      await sock.sendMessage(remoteJid, { text }, { quoted: message });
    } else {
      logCustom("info", content, `ERROR-COMMAND-${command}.txt`);
      // Respons kosong atau tidak ada data
      await sock.sendMessage(
        remoteJid,
        { text: "Maaf, data akun tidak ditemukan. Pastikan ID dan server benar." },
        { quoted: message }
      );
    }
  } catch (error) {
    console.error("Error:", error);
    logCustom("info", content, `ERROR-COMMAND-${command}.txt`);

    // Penanganan kesalahan dengan pesan ke pengguna
    await sock.sendMessage(
      remoteJid,
      {
        text: `Maaf, terjadi kesalahan saat memproses permintaan Anda. Coba lagi nanti.\n\nDetail: ${
          error.message || error
        }`,
      },
      { quoted: message }
    );
  }
}
export default {
  handle,
  Commands: ["ml2", "stalkml"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
