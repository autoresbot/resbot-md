import { incrementUserChatCount } from '../lib/totalchat.js';
import { markUserActive } from '../lib/users.js';
import { addChat } from '../lib/chatManager.js';
import { downloadMedia } from '../lib/utils.js';
import { findGroup } from '../lib/group.js';

async function process(sock, messageInfo) {
  const { remoteJid, message, id, sender, senderLid, isGroup, fullText, type } = messageInfo;

  try {
    if (isGroup) {
      await incrementUserChatCount(remoteJid, sender);

      // Perbarui waktu aktif terakhir user agar deteksi sider (.gcsider) akurat.
      // Wajib LID: data user disimpan per LID. Dulu memakai `sender` (nomor HP
      // di grup), sehingga SETIAP orang yang chat di grup dibuatkan record user
      // kedua berbasis nomor HP — tabel users membengkak dua kali lipat.
      markUserActive(senderLid || sender);

      let newMessage;
      // Stiker hanya diunduh kalau antidelete menyala di grup ini (file-nya
      // dipakai untuk mengirim ulang stiker yang dihapus). Dulu SETIAP stiker
      // di semua grup diunduh & didekripsi — boros CPU, bandwidth, dan disk.
      if (type === 'sticker' && (await findGroup(remoteJid))?.fitur?.antidelete) {
        const mediaPath = `./tmp/${await downloadMedia(message)}`;
        newMessage = {
          id,
          text: mediaPath,
          type,
        };
      } else if (fullText) {
        // Jika fullText tersedia, gunakan sebagai teks
        newMessage = {
          id,
          text: fullText,
        };
      }

      // Jika newMessage diatur, tambahkan ke obrolan
      if (newMessage) {
        addChat(sender, newMessage);
      }
    }
  } catch (error) {
    // Pesan error-nya wajib ikut dicetak: versi lama hanya mencetak label tanpa
    // isi error, sehingga kegagalan di sini (mis. downloadMedia) tidak bisa
    // dilacak sama sekali.
    console.error('Error dalam proses Chat:', error?.message || error);
  }

  return true; // Lanjutkan ke plugin berikutnya
}

export default {
  name: 'Chat',
  priority: 3,
  process,
};
