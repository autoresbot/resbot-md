import { findGroup, updateGroup } from '../../lib/group.js';
import { sendMessageWithMention } from '../../lib/utils.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message, sender, content, prefix, command, senderType } = messageInfo;

  try {
    // ✅ Validasi input
    if (!content || content.trim() === '') {
      const tex = `_⚠️ Format Penggunaan:_\n\n💬 Contoh:\n*${prefix + command}* https://chat.whatsapp.com/xxx 30`;
      return await sock.sendMessage(remoteJid, { text: tex }, { quoted: message });
    }

    let [linkgrub, jumlahHariPremium] = content.split(' ');

    linkgrub = linkgrub?.match(/https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+/i)?.[0];

    if (!linkgrub || isNaN(jumlahHariPremium)) {
      const tex = `⚠️ _Pastikan format yang benar:_\n${prefix + command} https://chat.whatsapp.com/xxx 30`;
      return await sock.sendMessage(remoteJid, { text: tex }, { quoted: message });
    }

    await sock.sendMessage(remoteJid, {
      react: { text: '⏰', key: message.key },
    });

    jumlahHariPremium = parseInt(jumlahHariPremium);

    const idFromGc = linkgrub.split('https://chat.whatsapp.com/')[1];

    const res = await sock.query({
      tag: 'iq',
      attrs: { type: 'get', xmlns: 'w:g2', to: '@g.us' },
      content: [{ tag: 'invite', attrs: { code: idFromGc } }],
    });

    if (!res.content?.[0]?.attrs?.id) {
      const tex = `⚠️ _Link grup tidak valid atau pastikan bot sudah bergabung_`;
      await sock.sendMessage(remoteJid, { text: tex }, { quoted: message });
      return;
    }

    const groupId = res.content[0].attrs.id + '@g.us';

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
