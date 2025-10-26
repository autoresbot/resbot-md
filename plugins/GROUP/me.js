import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;

import config from "../../config.js";

import { findUser, isOwner, isPremiumUser } from "../../lib/users.js";
import { getGroupMetadata, getProfilePictureUrl } from "../../lib/cache.js";

const getCountryFlag = (sender) => {
  const countryCode = sender.slice(0, 2); // Dua angka pertama
  const flagMap = {
    62: "./62.png", // Indonesia
    60: "./60.png", // Malaysia
  };
  return flagMap[countryCode] || "./0.png";
};

const getAchievementBadge = (achievement) => {
  const achievementsList = [
    "gamers",
    "coding",
    "conqueror",
    "100",
    "content creator",
    "fotografer",
    "music",
    "ilmuwan",
    "petualang",
    "hacker",
    "snake",
    "bull",
    "bear",
    "tiger",
    "cobra",
    "wolf",
    "imortal",
  ];
  return achievementsList.includes(achievement)
    ? `./${achievement}.png`
    : "./gamers.png";
};

async function handle(sock, messageInfo) {
  try {
    const { remoteJid, isGroup, message, sender, pushName } = messageInfo;
    const Nosender = sender.split("@")[0];

    const dataUsers = await findUser(sender);
    if (!dataUsers) return;

    const [docId, userData] = dataUsers;

    if (!isGroup) {
      await sock.sendMessage(
        remoteJid,
        { text: "Gunakan .me2 ya kak" },
        { quoted: message }
      );
      return;
    }

    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    const participants = groupMetadata.participants;
    const isAdmin = participants.some(
      (p) => (p.phoneNumber === sender || p.id === sender) && p.admin
    );

    const roleInGrub = isAdmin ? "Admin" : "Member";
    const role = isOwner(sender)
      ? "Owner"
      : isPremiumUser(sender)
      ? "Premium"
      : userData.role;

    const ppUser = await getProfilePictureUrl(sock, sender);
    const flag = getCountryFlag(sender);
    const achievement = getAchievementBadge(userData.achievement);

    const api = new ApiAutoresbot(config.APIKEY);
    const buffer = await api.getBuffer("/api/maker/profile4", {
      name: userData.username || pushName,
      level_cache: userData.level_cache || 0,
      nosender: Nosender,
      role,
      level: userData.level || 0,
      money: userData.money || 0,
      limit: userData.limit || 0,
      roleInGrub,
      flag,
      badge: achievement,
      pp: ppUser,
    });

    await sock.sendMessage(
      remoteJid,
      { image: buffer, caption: "" },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error in handle function:", error.message);
  }
}

export default {
  handle,
  Commands: ["me", "limit"],
  OnlyPremium: false,
  OnlyOwner: false,
};
