import { transferBalance } from '../../lib/users.js';
import { convertToJid } from '../../lib/utils.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, senderLid, command, prefix } = messageInfo;

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
    if (!receiverJid) {
      return await sock.sendMessage(
        remoteJid,
        { text: `⚠️ _User tidak ditemukan, pastikan target sudah chat di grub ini_` },
        { quoted: message },
      );
    }

    const moneyToSend = parseInt(args[1], 10);

    // Transaksi atomic: pengirim & penerima ter-update bersama atau tidak sama sekali
    const result = transferBalance(senderLid, receiverJid, moneyToSend, 'money');

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
        } | from=${senderLid} to=${receiverJid} amount=${moneyToSend}`,
      );

      return await sock.sendMessage(
        remoteJid,
        { text: messages[result.reason] || messages.error },
        { quoted: message },
      );
    }

    console.log(
      `[SENDMONEY] Success | from=${senderLid} to=${receiverJid} amount=${moneyToSend} | ` +
        `sender ${result.fromBefore}->${result.fromAfter} recipient ${result.toBefore}->${result.toAfter}`,
    );

    // Kirim pesan berhasil
    return await sock.sendMessage(
      remoteJid,
      {
        text: `✅ _Berhasil mengirim ${moneyToSend} money ke ${
          receiverJid.split('@')[0]
        }._\n\nKetik *.me* untuk melihat detail akun Anda.`,
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
