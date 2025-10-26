import { findUser } from "../../lib/users.js";
import { isOwner, isPremiumUser } from "../../lib/users.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, sender, pushName } = messageInfo;

  // Ambil data pengguna
  const dataUsers = await findUser(sender);
  if (!dataUsers) return;

  const [docId, userData] = dataUsers;

  const role = isOwner(sender)
    ? "Owner"
    : isPremiumUser(sender)
    ? "Premium"
    : userData.role;

  let teks = `
╭─── _*MY PROFILE*_ 
├────
├──
│ Level : *${userData.level || 0}*
│ Limit : *${userData.limit || 0}*
│ Money : *${userData.money || 0}*
│ Role : *${role}*
│
├────
╰────────────────────────`;

  await sock.sendMessage(remoteJid, { text: teks }, { quoted: message });
}

export default {
  handle,
  Commands: ["me2", "limit2"],
  OnlyPremium: false,
  OnlyOwner: false,
};
