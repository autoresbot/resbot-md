import mess from '../../strings.js';
import { getGroupMetadata, pesertaAdalahAdmin, nomorDari } from '../../lib/cache.js';

/**
 * Semua bentuk identitas bot (nomor telepon & LID).
 *
 * Dibutuhkan untuk dua hal: menentukan `fromMe` pada perintah hapus, dan
 * mengecek apakah bot sendiri sudah admin (syarat menghapus pesan anggota).
 */
function identitasBot(sock) {
  const kredensial = sock?.zapo?.auth?.getCurrentCredentials?.() ?? null;
  return [
    kredensial?.meJid,
    kredensial?.meLid,
    sock?.user?.id,
    global.phone_number_bot,
  ].filter(Boolean);
}

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, message, isQuoted, sender, senderLid } = messageInfo;
  if (!isGroup) return; // Only Grub

  const balas = (text) => sock.sendMessage(remoteJid, { text }, { quoted: message });

  try {
    // Mendapatkan metadata grup
    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    const participants = groupMetadata?.participants ?? [];

    // Dicocokkan lewat semua bentuk identitas: di grup ber-alamat LID, `id`
    // peserta berupa @lid sedangkan pengirim dikenali lewat nomor telepon.
    const isAdmin = pesertaAdalahAdmin(participants, sender, senderLid);
    if (!isAdmin) {
      return balas(mess.general.isAdmin);
    }

    if (!isQuoted) {
      return balas('⚠️ _Balas pesan yang mau di hapus_');
    }

    const identitas = identitasBot(sock);
    const nomorBot = new Set(identitas.map(nomorDari).filter(Boolean));

    // `fromMe` WAJIB diisi eksplisit dan BENAR.
    //
    // zapo memakai `key.fromMe` apa adanya saat merakit protocolMessage REVOKE
    // (targetMessageKey -> buildMessageKey). Kalau field ini tidak ada, WhatsApp
    // mencari pesan milik PENGIRIM PERINTAH dengan id tersebut — jadi menghapus
    // pesan bot sendiri kebetulan berhasil, sementara pesan anggota lain tidak
    // pernah ketemu dan penghapusannya gagal diam-diam. Itulah sebabnya `.del`
    // dulu hanya bekerja untuk pesan bot.
    const fromMe = nomorBot.has(nomorDari(isQuoted.sender));

    // Menghapus pesan ORANG LAIN adalah "admin revoke": yang menghapus harus
    // admin grup, dan di sini yang mengirim perintah hapus adalah bot.
    if (!fromMe && !pesertaAdalahAdmin(participants, ...identitas)) {
      return balas(
        '⚠️ _Bot harus jadi admin grup dulu untuk menghapus pesan anggota._\n' +
          '_Pesan bot sendiri tetap bisa dihapus tanpa itu._',
      );
    }

    await sock.sendMessage(remoteJid, {
      delete: {
        remoteJid,
        id: isQuoted.id,
        participant: isQuoted.sender,
        fromMe,
      },
    });
  } catch (error) {
    // Pesan error-nya ikut ditampilkan: kegagalan hapus hampir selalu punya
    // sebab yang jelas (bot bukan admin, pesan terlalu lama, id tidak valid),
    // dan "silakan coba lagi" tidak membantu siapa pun.
    console.error('Error handling command .del:', error);
    await balas(`⚠️ _Gagal menghapus pesan: ${error?.message || error}_`);
  }
}

export default {
  handle,
  Commands: ['del', 'delete'],
  OnlyPremium: false,
  OnlyOwner: false,
};
