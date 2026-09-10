import { findUser, updateUser } from '../../lib/users.js';
import { formatRemainingTime } from '../../lib/utils.js';

const claimInProgressUsers = new Set();

async function handle(sock, messageInfo) {
  const { remoteJid, message, senderLid } = messageInfo;

  const CLAIM_COOLDOWN_MINUTES = 120; // 120 atau 2 jam
  const MIN_CLAIM = 1;
  const MAX_CLAIM = 10;
  const CLAIM_COOLDOWN = CLAIM_COOLDOWN_MINUTES * 60 * 1000;

  if (!senderLid) return;

  if (claimInProgressUsers.has(senderLid)) {
    return await sock.sendMessage(
      remoteJid,
      {
        text: '⏳ _Proses claim kamu masih berjalan. Tunggu sebentar ya._',
      },
      { quoted: message },
    );
  }

  claimInProgressUsers.add(senderLid);

  try {
    const dataUsers = await findUser(senderLid);
    if (!dataUsers) return;

    const [docId, userData] = dataUsers;
    const currentTime = Date.now();
    const lastClaim = Number(userData.lastClaim) || 0;

    if (lastClaim && currentTime - lastClaim < CLAIM_COOLDOWN) {
      const remainingTime = Math.floor((CLAIM_COOLDOWN - (currentTime - lastClaim)) / 1000);
      const formattedTime = formatRemainingTime(remainingTime);

      return await sock.sendMessage(
        remoteJid,
        {
          text: `🔒 _Kamu sudah klaim sebelumnya!_ Tunggu *${formattedTime}* lagi sebelum bisa claim lagi.`,
        },
        { quoted: message },
      );
    }

    const moneyClaim = Math.floor(Math.random() * (MAX_CLAIM - MIN_CLAIM + 1)) + MIN_CLAIM;
    const limitClaim = Math.floor(Math.random() * (MAX_CLAIM - MIN_CLAIM + 1)) + MIN_CLAIM;

    await updateUser(senderLid, {
      money: (Number(userData.money) || 0) + moneyClaim,
      limit: (Number(userData.limit) || 0) + limitClaim,
      lastClaim: currentTime,
    });

    return await sock.sendMessage(
      remoteJid,
      {
        text: `_Kamu dapat *${moneyClaim}* money dan *${limitClaim}* limit!_`,
      },
      { quoted: message },
    );
  } finally {
    claimInProgressUsers.delete(senderLid);
  }
}

export default {
  handle,
  Commands: ['claim'],
  OnlyPremium: false,
  OnlyOwner: false,
};
