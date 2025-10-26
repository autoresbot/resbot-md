import { findUser, updateUser, addUser } from "../../lib/users.js";
import { formatRemainingTime } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, sender } = messageInfo;

  const CLAIM_COOLDOWN_MINUTES = 120; // 120 atau 2 jam
  const MIN_CLAIM = 1;
  const MAX_CLAIM = 10;

  const MoneyClaim =
    Math.floor(Math.random() * (MAX_CLAIM - MIN_CLAIM + 1)) + MIN_CLAIM;
  const LimitClaim =
    Math.floor(Math.random() * (MAX_CLAIM - MIN_CLAIM + 1)) + MIN_CLAIM;

  // Ambil data user
  const dataUsers = await findUser(sender);
  if (dataUsers) {
    const [docId, userData] = dataUsers;
    const currentTime = Date.now();
    const CLAIM_COOLDOWN = CLAIM_COOLDOWN_MINUTES * 60 * 1000;

    if (
      userData.lastClaim &&
      currentTime - userData.lastClaim < CLAIM_COOLDOWN
    ) {
      const remainingTime = Math.floor(
        (CLAIM_COOLDOWN - (currentTime - userData.lastClaim)) / 1000
      );
      const formattedTime = formatRemainingTime(remainingTime);
      return await sock.sendMessage(
        remoteJid,
        {
          text: `🔒 _Kamu Sudah Klaim Sebelumnya!_ _Harap tunggu *${formattedTime}* lagi sebelum kamu bisa klaim kembali_.`,
        },
        { quoted: message }
      );
    }

    await updateUser(sender, {
      money: userData.money + MoneyClaim,
      limit: userData.limit + LimitClaim,
      lastClaim: currentTime,
    });

    return await sock.sendMessage(
      remoteJid,
      {
        text: `_Kamu dapat *${MoneyClaim}*_ _money dan *${LimitClaim}* limit!_`,
      },
      { quoted: message }
    );
  } else {
    return;
  }
}

export default {
  handle,
  Commands: ["claim"],
  OnlyPremium: false,
  OnlyOwner: false,
};
