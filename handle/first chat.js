const respondedSenders = new Set();
import { getGreeting } from '../lib/utils.js';

async function process(sock, messageInfo) {
  const { sender, remoteJid, isGroup, message, pushName, fullText } = messageInfo;

  // KOMENTARI INI UNTUK MENGHIDUPKAN
  return true;

  const salam = getGreeting();
  if (isGroup) return true; // Abaikan jika pesan berasal dari grup
  if (pushName == 'Unknown') return true;
  if (!fullText) return true;
  if (['batu', 'kertas', 'gunting'].includes(fullText.toLowerCase())) return;

  if (remoteJid == 'status@broadcast') return true; // abaikan story

  // Cek apakah sender sudah pernah diberi respons
  if (respondedSenders.has(sender)) return true;

  const response = `🌟 _*Pesan Otomatis*_ 🌟 

👋 _${salam}_ _Kak_ *${pushName}*, _Nomor ini adalah nomor bot yang tersedia untuk di sewa pada sebuah grub._

⚠️ _Kami sangat melarang jika bot kami digunakan untuk tindak penipuan atau kegiatan ilegal lainnya._

_*Informasi lebih lanjut*_
📞 Owner : https://wa.me/6285246154386?text=sewabot+4.0
💻 Website : https://autoresbot.com
👉 Saluran : https://www.whatsapp.com/channel/0029VaDSRuf05MUekJbazP1D`;

  try {
    // Kirim pesan balasan ke pengirim
    await sock.sendMessage(sender, { text: response }, { quoted: message });

    // Tandai pengirim sebagai sudah diberi respons
    respondedSenders.add(sender);
  } catch (error) {
    console.error('Error in first chat process:', error);
  }

  return true;
}

export default {
  name: 'First Chat',
  priority: 10,
  process,
};
