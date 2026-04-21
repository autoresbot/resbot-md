import { setTemplateList } from "../../lib/participants.js";
import { getGroupMetadata } from "../../lib/cache.js";
import mess from "../../strings.js";

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, content, sender, command, prefix } =
    messageInfo;

  // Periksa apakah pesan berasal dari grup
  if (!isGroup) return;

  // Mendapatkan metadata grup
  const groupMetadata = await getGroupMetadata(sock, remoteJid);
  const participants = groupMetadata.participants;
  const isAdmin = participants.some(
    (p) => (p.phoneNumber === sender || p.id === sender) && p.admin
  );
  if (!isAdmin) {
    await sock.sendMessage(
      remoteJid,
      { text: mess.general.isAdmin },
      { quoted: message }
    );
    return;
  }

  // Validasi input kosong
  if (!content || !content.trim()) {
    const usageMessage = `⚠️ *Format Penggunaan:*

💬 *Contoh:* 
_${prefix}${command} 1_

_Hanya tersedia *1 sampai 9*_`;

    await sock.sendMessage(
      remoteJid,
      { text: usageMessage },
      { quoted: message }
    );
    return;
  }

  // Validasi input harus angka 1 sampai 8
  const validNumbers = /^[1-9]$/; // Regex untuk angka 1-8
  if (!validNumbers.test(content.trim())) {
    const invalidMessage = `⚠️ _Input tidak valid!_

_Hanya diperbolehkan angka dari *1* sampai *9*._`;
    await sock.sendMessage(
      remoteJid,
      { text: invalidMessage },
      { quoted: message }
    );
    return;
  }

  // Atur template list
  await setTemplateList(remoteJid, content);

  // Kirim pesan sukses
  const successMessage = `✅ _Template List Berhasil Diatur_

_Ketik *.list* untuk melihat daftar list_`;

  await sock.sendMessage(
    remoteJid,
    { text: successMessage },
    { quoted: message }
  );
}

export default {
  handle,
  Commands: ["settemplatelist", "templatelist"],
  OnlyPremium: false,
  OnlyOwner: false,
};
