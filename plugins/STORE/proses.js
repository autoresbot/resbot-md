import {
  sendMessageWithMention,
  getCurrentTime,
  getCurrentDate,
  reply,
  getSenderType,
} from '../../lib/utils.js';
import { getGroupMetadata, pesertaAdalahAdmin, jidPesertaGrup } from '../../lib/cache.js';
import { sendImageAsSticker } from '../../lib/exif.js';
import { checkMessage } from '../../lib/participants.js';
import mess from '../../strings.js';
import config from '../../config.js';
import fs from 'fs';

async function handle(sock, messageInfo) {
  const { m, remoteJid, sender, senderLid, message, isQuoted } = messageInfo;

  try {
    // Mendapatkan metadata grup
    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    const participants = groupMetadata.participants;
    // Dicocokkan lewat semua bentuk identitas: di grup ber-alamat LID, `id`
    // peserta berupa @lid sedangkan pengirim dikenali lewat nomor telepon
    // (atau sebaliknya), dan `phoneNumber` tidak selalu dikirim WhatsApp.
    const isAdmin = pesertaAdalahAdmin(participants, sender, senderLid);
    if (!isAdmin) {
      await sock.sendMessage(remoteJid, { text: mess.general.isAdmin }, { quoted: message });
      return;
    }

    // Validasi pesan yang dibalas
    if (!isQuoted) {
      return await reply(m, '⚠️ _Balas sebuah pesanan berupa teks._');
    }

    const first_checksetdone = await checkMessage(remoteJid, 'setproses');

    // Mendapatkan tanggal dan waktu saat ini
    const date = getCurrentDate();
    const time = getCurrentTime();

    // Mendapatkan metadata grup
    const groupName = groupMetadata.subject || 'Grup';

    // Menyiapkan catatan dari pesan yang dikutip
    const note = isQuoted.content?.caption ? isQuoted.content.caption : isQuoted.text;

    // Bentuk JID pengirim pesan yang di-quote disamakan dengan yang dipakai
    // grup. `contextInfo.participant` bisa berupa LID atau nomor telepon
    // tergantung versi WhatsApp pengirimnya, sementara tag hanya tampil kalau
    // teks `@nomor` dan JID yang di-mention memakai bentuk yang SAMA — itulah
    // sebabnya tag sering muncul sebagai nomor asing, bukan nama.
    const quotedJid = jidPesertaGrup(participants, isQuoted.sender) || isQuoted.sender;
    const quotedSender = `@${quotedJid.split('@')[0]}`;
    const statusJid = getSenderType(quotedJid);

    if (first_checksetdone) {
      // Jika ada setingan set done
      try {
        if (first_checksetdone.endsWith('.webp')) {
          // Kirim sticker
          const buffer = fs.readFileSync(first_checksetdone);

          const options = {
            packname: config.sticker_packname,
            author: config.sticker_author,
          };

          await sendImageAsSticker(sock, remoteJid, buffer, options, message);
          return;
        } else {
          // Ganti placeholder dengan nilai sebenarnya
          const messageSetdone = first_checksetdone
            .replace(/@time/g, time)
            .replace(/@tanggal/g, date)
            .replace(/@grub/g, groupName)
            .replace(/@catatan/g, note)
            .replace(/@sender/g, quotedSender);

          // Mention dioper eksplisit: kalau ditebak dari teks, `@nomor` yang
          // kebetulan ada di dalam catatan pesanan ikut jadi mention palsu dan
          // domainnya ditebak dari tipe pengirim.
          await sendMessageWithMention(sock, remoteJid, messageSetdone, message, statusJid, [
            quotedJid,
          ]);
          return;
        }
      } catch (error) {
        console.error('Error processing setproses:', error);
      }
    }

    // Default pesan transaksi pending
    const templateMessage = `_*TRANSAKSI PENDING ✅ 」*_

⏰ Jam      : ${time} WIB
📅 Tanggal  : ${date}
📂 Grup     : ${groupName}
📝 Catatan  : ${note}

${quotedSender} _Terima kasih sudah order!_`;

    // Mengirim pesan dengan mention
    await sendMessageWithMention(sock, remoteJid, templateMessage, message, statusJid, [quotedJid]);
  } catch (error) {
    console.error('Terjadi kesalahan:', error);
  }
}

export default {
  handle,
  Commands: ['proses'],
  OnlyPremium: false,
  OnlyOwner: false,
};
