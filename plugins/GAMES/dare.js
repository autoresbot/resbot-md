import { readFileAsBuffer } from "../../lib/fileHelper.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(
  __dirname,
  "../../database/assets/game truth dare.jpg"
);
const buffer = readFileAsBuffer(filePath);

// Daftar dare
const dares = [
  'Kirim pesan ke mantan kamu dan bilang "aku masih suka sama kamu"',
  "Telepon crush/pacar sekarang dan screenshot hasilnya ke pemain",
  "Pap ke salah satu anggota grup",
  'Bilang "KAMU CANTIK BANGET NGGAK BOHONG" ke cowo',
  "Screenshot recent call WhatsApp",
  'Drop emot "🤸💨" setiap mengetik di grup/pc selama 1 hari',
  'Kirim voice note bilang "Can I call u baby?"',
  "Drop kutipan lagu/quote, lalu tag member yang cocok untuk kutipan itu",
  "Pakai foto Sule sebagai profil selama 3 hari",
  "Ketik menggunakan bahasa daerah selama 24 jam",
  'Ganti nama menjadi "gue anak Lucinta Luna" selama 5 jam',
  'Chat ke kontak WhatsApp sesuai urutan % baterai kamu, bilang "I lucky to have you"',
  'Prank chat mantan dan bilang "I love you, pengen balikan"',
  "Record voice membaca surah Al-Kautsar",
  'Bilang "I have a crush on you, mau jadi pacarku nggak?" ke lawan jenis terakhir yang kamu chat (WhatsApp/Telegram), tunggu dia bales, lalu screenshot dan drop ke grup',
  "Sebutkan tipe pacar idealmu!",
  "Snap/post foto pacar/crush",
  "Teriak nggak jelas lalu kirim voice note ke grup",
  "Pap mukamu lalu kirim ke salah satu temanmu",
  'Kirim fotomu dengan caption "Aku anak pungut"',
  "Teriak menggunakan kata kasar sambil voice note lalu kirim ke grup",
  'Teriak "Anjimm gabut anjimmm!" di depan rumahmu',
  'Ganti nama menjadi "BOWO" selama 24 jam',
  "Pura-pura kerasukan, contoh: kerasukan maung, belalang, kulkas, dll.",
];

// Fungsi untuk menangani pesan
async function handle(sock, messageInfo) {
  const { remoteJid, message } = messageInfo;

  // Pilih dare secara acak
  const selectedDare = dares[Math.floor(Math.random() * dares.length)];

  // Kirim pesan dengan gambar dan caption
  await sock.sendMessage(
    remoteJid,
    {
      image: buffer,
      caption: `*Dare*\n\n${selectedDare}`,
    },
    { quoted: message }
  );
}

export default {
  handle,
  Commands: ["dare"],
  OnlyPremium: false,
  OnlyOwner: false,
};
