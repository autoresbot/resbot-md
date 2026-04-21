import { sendMessageWithMention, convertToJid } from '../lib/utils.js';
import { listOwner } from '../lib/users.js';
import config from '../config.js';

export async function handle(sock, messageInfo) {
  const { remoteJid, message, sender, senderType } = messageInfo;

  const data = listOwner();

  let list = [];
  let no = 1;

  for (const item of data) {
    // convert nomor ke jid dulu
    const numberJid = await convertToJid(sock, item);
    const number = numberJid.split('@')[0];

    const vcard = `BEGIN:VCARD
VERSION:3.0
N:Owner ${no}
FN:Owner ${no}
TEL;waid=${number}:${number}
EMAIL;type=INTERNET:${config.owner_email}
URL:https://autoresbot.com
ADR:;;${config.region};;;
END:VCARD`;

    list.push({
      displayName: `Owner ${no}`,
      vcard: vcard,
    });

    no++;
  }

  if (data.length === 0) {
    return await sendMessageWithMention(
      sock,
      remoteJid,
      'Owner belum terdaftar!',
      message,
      senderType,
    );
  }

  const chatId = await sock.sendMessage(
    remoteJid,
    {
      contacts: {
        displayName: `Daftar Owner (${data.length})`,
        contacts: list,
      },
    },
    { quoted: message },
  );

  await sendMessageWithMention(
    sock,
    remoteJid,
    `Hai Kak @${sender.split('@')[0]}, berikut adalah daftar owner bot ini`,
    chatId,
    senderType,
  );
}

export default {
  Commands: ['owner'],
  OnlyPremium: false,
  OnlyOwner: false,
  handle,
};
