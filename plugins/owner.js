import { sendMessageWithMention, convertToJid } from '../lib/utils.js';
import { listOwner } from '../lib/users.js';
import config from '../config.js';

/** Samakan bentuk kunci: ambil digitnya saja (buang @lid/@s.whatsapp.net/device-id). */
function kunciNomor(nilai) {
  return String(nilai ?? '').replace(/[^0-9]/g, '');
}

/**
 * Nama tampilan untuk satu owner, diambil berurutan dari:
 *   1. config.owner_names — dicocokkan lewat entri aslinya maupun digitnya,
 *      jadi boleh ditulis '628xx', '628xx@lid', atau '628xx@s.whatsapp.net'.
 *   2. config.owner_name — hanya kalau ownernya memang cuma satu, supaya
 *      beberapa owner tidak tampil dengan nama yang sama persis.
 *   3. nomornya sendiri — tetap lebih informatif daripada "Owner 1".
 */
function namaOwner(entriAsli, number, jumlahOwner) {
  const peta = config.owner_names ?? {};

  const langsung = peta[entriAsli];
  if (typeof langsung === 'string' && langsung.trim()) return langsung.trim();

  const digit = kunciNomor(entriAsli) || kunciNomor(number);
  for (const [key, nama] of Object.entries(peta)) {
    if (kunciNomor(key) === digit && typeof nama === 'string' && nama.trim()) {
      return nama.trim();
    }
  }

  if (jumlahOwner === 1 && config.owner_name?.trim()) return config.owner_name.trim();

  return number;
}

export async function handle(sock, messageInfo) {
  const { remoteJid, message, sender, senderType } = messageInfo;

  const data = listOwner();

  let list = [];

  for (const item of data) {
    // convert nomor ke jid dulu
    const numberJid = await convertToJid(sock, item);
    const number = numberJid.split('@')[0];
    const nama = namaOwner(item, number, data.length);

    // Nama dipakai apa adanya di N/FN. Titik dua & titik koma adalah pemisah
    // field vCard, jadi harus di-escape agar kartunya tidak rusak.
    const namaVcard = nama.replace(/([;,\\])/g, '\\$1');

    const vcard = `BEGIN:VCARD
VERSION:3.0
N:${namaVcard}
FN:${namaVcard}
TEL;waid=${number}:${number}
EMAIL;type=INTERNET:${config.owner_email}
URL:https://autoresbot.com
ADR:;;${config.region};;;
END:VCARD`;

    list.push({
      displayName: nama,
      vcard: vcard,
    });
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
