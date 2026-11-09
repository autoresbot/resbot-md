import { findGroup, updateGroup } from '../../lib/group.js';
import { sendMessageWithMention } from '../../lib/utils.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message, sender, content, prefix, command, senderType } = messageInfo;

  try {
    const { isGroup } = messageInfo;

    // ✅ Validasi input
    if (!content || content.trim() === '') {
      const tex =
        `_⚠️ Format Penggunaan:_\n\n` +
        `💬 Contoh (pakai link):\n*${prefix + command}* https://chat.whatsapp.com/xxx 30\n` +
        `💬 Contoh (pakai id grup):\n*${prefix + command}* 1203xxxx@g.us 30\n` +
        `💬 Atau jalankan di dalam grup:\n*${prefix + command}* 30`;
      return await sock.sendMessage(remoteJid, { text: tex }, { quoted: message });
    }

    const parts = content.trim().split(/\s+/);

    // Input yang diterima HANYA: link undangan, id grup (@g.us), atau cukup
    // jumlah hari bila dijalankan di dalam grup. Selain itu ditolak dengan
    // pesan jelas supaya tidak menimbulkan error.
    let target = parts[0];
    let jumlahHariPremium = parts[1];

    // Bentuk 1 argumen: ".addpremgrub 30" di dalam grup → target = grup ini.
    if (parts.length === 1 && /^\d+$/.test(parts[0]) && isGroup) {
      jumlahHariPremium = parts[0];
      target = remoteJid;
    }

    if (!jumlahHariPremium || isNaN(jumlahHariPremium) || parseInt(jumlahHariPremium) <= 0) {
      const tex = `⚠️ _Jumlah hari harus berupa angka (lebih dari 0)._\n${prefix + command} <link/id grup> 30`;
      return await sock.sendMessage(remoteJid, { text: tex }, { quoted: message });
    }

    await sock.sendMessage(remoteJid, {
      react: { text: '⏰', key: message.key },
    });

    jumlahHariPremium = parseInt(jumlahHariPremium);

    let groupId;
    const linkMatch = target.match(/https?:\/\/chat\.whatsapp\.com\/([A-Za-z0-9]+)/i);

    if (linkMatch) {
      // Via link undangan → resolve ke JID grup.
      const infoGrub = await sock.groupGetInviteInfo(linkMatch[1]);
      if (!infoGrub?.jid) {
        const tex = `⚠️ _Link grup tidak valid atau pastikan bot sudah bergabung_`;
        return await sock.sendMessage(remoteJid, { text: tex }, { quoted: message });
      }
      groupId = infoGrub.jid;
    } else if (/@g\.us$/i.test(target)) {
      // Via id grup langsung.
      groupId = target;
    } else if (/^\d{10,}$/.test(target)) {
      // Via angka id grup tanpa domain.
      groupId = `${target}@g.us`;
    } else {
      const tex = `⚠️ _Input tidak valid. Masukkan link undangan grup atau id grup (xxxx@g.us)._`;
      return await sock.sendMessage(remoteJid, { text: tex }, { quoted: message });
    }

    // ✅ Ambil data group dari database
    // Ambil data group
    const dataGrub = await findGroup(groupId);

    if (!dataGrub) {
      throw new Error('Group data not found');
    }

    // Hitung expired
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() + jumlahHariPremium);

    // Jika sudah ada premium → extend
    if (dataGrub?.fitur?.premium) {
      const oldDate = new Date(dataGrub.fitur.premium);

      if (oldDate > new Date()) {
        oldDate.setDate(oldDate.getDate() + jumlahHariPremium);
        expiredDate.setTime(oldDate.getTime());
      }
    }

    // Update data tanpa merusak fitur lain
    const updateData = {
      fitur: {
        ...dataGrub.fitur,
        premium: expiredDate.toISOString(),
      },
    };

    await updateGroup(groupId, updateData);

    const responseText =
      `✅ *Grup berhasil dijadikan Premium*\n\n` +
      `📅 Expired: *${expiredDate.toLocaleDateString()}*`;

    await sendMessageWithMention(sock, remoteJid, responseText, message, senderType);
  } catch (error) {
    console.error('Error processing premium addition:', error);

    await sock.sendMessage(
      remoteJid,
      { text: '❌ Terjadi kesalahan saat memproses data.' },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['addpremgrub', 'addpremiumgrub'],
  OnlyPremium: false,
  OnlyOwner: true,
};
