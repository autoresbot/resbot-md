import { findGroup, updateGroup } from '../../lib/group.js';
import { getGroupMetadata } from '../../lib/cache.js';
import { updateSocket } from '../../lib/scheduled.js';
import mess from '../../strings.js';

const icon_on = '🟢';
const icon_off = '🔴';

// Membantu untuk memformat status fitur
const formatFeatureStatus = (status) => (status ? icon_on : icon_off);

// Daftar fitur yang ada dalam group
const featureList = [
  { name: 'antilink', label: 'ᴀɴᴛɪʟɪɴᴋ' },
  { name: 'antilinkv2', label: 'ᴀɴᴛɪʟɪɴᴋᴠ2' },
  { name: 'antilinkwa', label: 'ᴀɴᴛɪʟɪɴᴋᴡᴀ' },
  { name: 'antilinkwav2', label: 'ᴀɴᴛɪʟɪɴᴋᴡᴀᴠ2' },
  { name: 'antilinkch', label: 'ᴀɴᴛɪʟɪɴᴋᴄʜ' },
  { name: 'antilinkchv2', label: 'ᴀɴᴛɪʟɪɴᴋᴄʜᴠ2' },
  { name: 'antidelete', label: 'ᴀɴᴛɪᴅᴇʟᴇᴛᴇ' },
  { name: 'antiedit', label: 'ᴀɴᴛɪᴇᴅɪᴛ' },
  { name: 'antigame', label: 'ᴀɴᴛɪɢᴀᴍᴇ' },
  { name: 'antifoto', label: 'ᴀɴᴛɪғᴏᴛᴏ' },
  { name: 'antivideo', label: 'ᴀɴᴛɪᴠɪᴅᴇᴏ' },
  { name: 'antiaudio', label: 'ᴀɴᴛɪᴀᴜᴅɪᴏ' },
  { name: 'antidocument', label: 'ᴀɴᴛɪᴅᴏᴄᴜᴍᴇɴᴛ' },
  { name: 'antikontak', label: 'ᴀɴᴛɪᴋᴏɴᴛᴀᴋ' },
  { name: 'antisticker', label: 'ᴀɴᴛɪsᴛɪᴄᴋᴇʀ' },
  { name: 'antipolling', label: 'ᴀɴᴛɪᴘᴏʟʟɪɴɢ' },
  { name: 'antispamchat', label: 'ᴀɴᴛɪsᴘᴀᴍᴄʜᴀᴛ' },
  { name: 'antivirtex', label: 'ᴀɴᴛɪᴠɪʀᴛᴇx' },
  { name: 'autoai', label: 'ᴀᴜᴛᴏᴀɪ' },
  { name: 'autosimi', label: 'ᴀᴜᴛᴏsɪᴍɪ' },
  { name: 'autorusuh', label: 'ᴀᴜᴛᴏʀᴜsᴜʜ' },
  { name: 'badword', label: 'ʙᴀᴅᴡᴏʀᴅ' },
  { name: 'badwordv2', label: 'ʙᴀᴅᴡᴏʀᴅv2' },
  { name: 'badwordv3', label: 'ʙᴀᴅᴡᴏʀᴅv3' },
  { name: 'detectblacklist', label: 'ᴅᴇᴛᴇᴄᴛʙʟᴀᴄᴋʟɪꜱᴛ' },
  { name: 'detectblacklist2', label: 'ᴅᴇᴛᴇᴄᴛʙʟᴀᴄᴋʟɪꜱᴛ2' },
  { name: 'demote', label: 'demote' },
  { name: 'left', label: 'ʟᴇғᴛ' },
  { name: 'promote', label: 'promote' },
  { name: 'welcome', label: 'ᴡᴇʟᴄᴏᴍᴇ' },
  { name: 'waktusholat', label: 'ᴡᴀᴋᴛᴜꜱʜᴏʟᴀᴛ' },
  { name: 'onlyadmin', label: 'ᴏɴʟʏᴀᴅᴍɪɴ' },
  { name: 'antibot', label: 'ᴀɴᴛɪʙᴏᴛ' },
  { name: 'antitagsw', label: 'ᴀɴᴛɪᴛᴀɢꜱᴡ' },
  { name: 'antitagsw2', label: 'ᴀɴᴛɪᴛᴀɢꜱᴡ2' },
  { name: 'antitagmeta', label: 'ᴀɴᴛɪᴛᴀɢᴍᴇᴛᴀ' },
  { name: 'antitagmeta2', label: 'ᴀɴᴛɪᴛᴀɢᴍᴇᴛᴀ2' },
  { name: 'antiforward', label: 'ᴀɴᴛɪꜰᴏʀᴡᴀʀᴅ' },
  { name: 'antiforward2', label: 'ᴀɴᴛɪꜰᴏʀᴡᴀʀᴅ2' },
  { name: 'antihidetag', label: 'ᴀɴᴛɪʜɪᴅᴇᴛᴀɢ' },
  { name: 'antihidetag2', label: 'ᴀɴᴛɪʜɪᴅᴇᴛᴀɢ2' },
  { name: 'notifultah', label: 'ɴᴏᴛɪꜰᴜʟᴛᴀʜ' },
];

// Membuat template dengan memeriksa status setiap fitur
const createTemplate = (fitur) => {
  let template = `ɢᴜɴᴀᴋᴀɴ *.off ᴄᴏᴍᴍᴀɴᴅ*\n\n`;

  featureList.forEach(({ name, label }) => {
    template += `[${formatFeatureStatus(fitur[name])}] ${label}\n`;
  });

  template += `

ᴄᴏɴᴛᴏʜ : *.ᴏff antilink*

Kᴇᴛᴇʀᴀɴɢᴀɴ
${icon_on} = Fɪᴛᴜʀ ᴀᴋᴛɪꜰ
${icon_off} = Fɪᴛᴜʀ ᴛɪᴅᴀᴋ ᴀᴋᴛɪꜰ`;

  return template;
};

// Fungsi untuk mengaktifkan fitur secara dinamis
const activateFeature = async (remoteJid, featureName, currentStatus) => {
  if (!currentStatus) {
    return `⚠️ _Fitur *${featureName}* sudah Nonaktifkan sebelumnya._`;
  }

  const updateData = { fitur: { [featureName]: false } };
  await updateGroup(remoteJid, updateData);
  return `🚀 _Berhasil Menonaktifkan Fitur *${featureName}*._`;
};

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, content, sender } = messageInfo;
  if (!isGroup) return; // Only Grub

  try {
    // Mendapatkan metadata grup
    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    const participants = groupMetadata.participants;
    const isAdmin = participants.some(
      (p) => (p.phoneNumber === sender || p.id === sender) && p.admin,
    );
    if (!isAdmin) {
      await sock.sendMessage(remoteJid, { text: mess.general.isAdmin }, { quoted: message });
      return;
    }

    const dataGrub = await findGroup(remoteJid);
    if (!dataGrub) {
      throw new Error('Group data not found');
    }

    // Cek jika konten cocok dengan fitur yang ada
    const feature = featureList.find(({ name }) => content.toLowerCase() === name.toLowerCase());

    if (feature) {
      const currentStatus = dataGrub.fitur[feature.name] || false;
      const result = await activateFeature(remoteJid, feature.name, currentStatus);

      if (content.toLowerCase() == 'waktusholat') {
        updateSocket(sock);
      }

      return await sock.sendMessage(remoteJid, { text: result }, { quoted: message });
    }

    // Jika tidak ada fitur yang cocok, kirim template status fitur
    const template_onchat = createTemplate(dataGrub.fitur);
    await sock.sendMessage(remoteJid, { text: template_onchat }, { quoted: message });
  } catch (error) {
    console.error('Error handling the message:', error);
    // Handling error jika grup data tidak ditemukan atau kesalahan lainnya
    await sock.sendMessage(
      remoteJid,
      { text: 'Terjadi kesalahan saat memproses perintah.' },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['off'],
  OnlyPremium: false,
  OnlyOwner: false,
};
