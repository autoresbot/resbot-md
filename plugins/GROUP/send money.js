import { transferBalance } from '../../lib/users.js';
import { convertToJid } from '../../lib/utils.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, sender, senderLid, mentionedJid, command, prefix } =
    messageInfo;

  // Validasi input kosong
  if (!content || content.trim() === '') {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ _Masukkan format yang valid_\n\n_Contoh: *${prefix + command} @tag 50*_`,
      },
      { quoted: message },
    );
  }

  try {
    // Pisahkan konten
    const args = content.trim().split(/\s+/);
    if (args.length < 2) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ _Format tidak valid. Contoh:_ *${prefix + command} @tag 50*`,
        },
        { quoted: message },
      );
    }

    const target = args[0]; // Nomor penerima atau tag
    const receiverJid = await convertToJid(sock, target);

    // Satu orang bisa punya dua record: versi LID (dibuat saat user chat di grup,
    // dan inilah yang dibaca `.me`) dan versi nomor telpon. Kandidat diurutkan
    // dari ruang identitas LID dulu agar money masuk ke record yang benar-benar
    // dilihat penerima, bukan ke record duplikat versi nomor.
    const receiverCandidates = [mentionedJid?.[0], target, receiverJid];
    const receiverLabel = String(receiverJid || target).replace(/\D/g, '') || target;

    const moneyToSend = parseInt(args[1], 10);

    // Transaksi atomic: pengirim & penerima ter-update bersama atau tidak sama sekali
    const result = transferBalance([senderLid, sender], receiverCandidates, moneyToSend, 'money');

    if (!result.ok) {
      const messages = {
        amount: `⚠️ _Jumlah money harus berupa angka positif_\n\n_Contoh: *${
          prefix + command
        } @tag 50*_`,
        self: `⚠️ _Anda tidak bisa mengirim money ke diri sendiri._`,
        sender_not_found: `⚠️ _Anda belum terdaftar, silakan chat di grup terlebih dahulu._`,
        recipient_not_found: `⚠️ _Penerima tidak ditemukan, pastikan target sudah chat di grub ini._`,
        insufficient: `⚠️ _Money Anda tidak cukup untuk mengirim ${moneyToSend} money._`,
        verification_failed: `⚠️ _Verifikasi transaksi gagal, transaksi dibatalkan. Money Anda tidak berkurang._`,
        error: `⚠️ _Terjadi kesalahan saat memproses transaksi. Money Anda tidak berkurang._`,
      };

      console.error(
        `[SENDMONEY] Failed: ${result.reason}${
          result.detail ? ` (${result.detail})` : ''
        } | from=${senderLid} to=${receiverCandidates.filter(Boolean).join('|')} amount=${moneyToSend}`,
      );

      return await sock.sendMessage(
        remoteJid,
        { text: messages[result.reason] || messages.error },
        { quoted: message },
      );
    }

    console.log(
      `[SENDMONEY] Success | from=${result.fromDocId} to=${result.toDocId} amount=${moneyToSend} | ` +
        `sender ${result.fromBefore}->${result.fromAfter} recipient ${result.toBefore}->${result.toAfter}`,
    );

    // Kirim pesan berhasil
    return await sock.sendMessage(
      remoteJid,
      {
        text: `✅ _Berhasil mengirim ${moneyToSend} money ke ${receiverLabel}._\n\nKetik *.me* untuk melihat detail akun Anda.`,
      },
      { quoted: message },
    );
  } catch (error) {
    console.error(`[SENDMONEY] Failed: unexpected error (${error.message})`);

    // Kirim pesan error
    return await sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.`,
      },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['sendmoney'],
  OnlyPremium: false,
  OnlyOwner: false,
};
