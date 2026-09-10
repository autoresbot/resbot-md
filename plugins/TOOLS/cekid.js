async function handle(sock, messageInfo) {
  const { remoteJid, message, mentionedJid, content } = messageInfo;

  try {
    let target;

    // Prioritas 1: Mention
    if (mentionedJid?.length) {
      target = mentionedJid[0];
    }

    // Prioritas 2: Nomor langsung
    if (!target && content) {
      const number = content.replace(/\D/g, '');

      if (!number) {
        return await sock.sendMessage(
          remoteJid,
          { text: 'Format nomor tidak valid.' },
          { quoted: message },
        );
      }

      target = `${number}@s.whatsapp.net`;
    }

    if (!target) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: 'Gunakan:\n' + '.cekid @user\n' + '.cekid 628xxxxxxxxxx',
        },
        { quoted: message },
      );
    }

    let text = `📌 ID User: ${target}`;

    try {
      //const lid = await sock.getLIDForPN?.(target);

      const lid = await sock.signalRepository.lidMapping.getPNForLID(target);

      if (lid) {
        text += `\n📌 LID: ${lid}`;
      }
    } catch (e) {
      console.error('[GET LID ERROR]', e);
    }

    await sock.sendMessage(remoteJid, { text }, { quoted: message });
  } catch (error) {
    console.error('[CEKID ERROR]', error);

    await sock.sendMessage(remoteJid, { text: 'Maaf, terjadi kesalahan.' }, { quoted: message });
  }
}

export default {
  handle,
  Commands: ['cekid'],
  OnlyPremium: false,
  OnlyOwner: false,
};
