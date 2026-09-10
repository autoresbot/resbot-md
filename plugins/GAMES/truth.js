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

// Daftar pertanyaan truth
const truths = [
  "Pernah suka sama siapa aja? Berapa lama?",
  "Kalau boleh atau kalau mau, di grup/luar grup siapa yang akan kamu jadikan sahabat? (boleh beda/jenis sama)",
  "Apa ketakutan terbesar kamu?",
  "Pernah suka sama orang dan merasa orang itu suka sama kamu juga?",
  "Siapa nama mantan pacar temanmu yang pernah kamu sukai diam-diam?",
  "Pernah nggak nyuri uang nyokap atau bokap? Alasannya?",
  "Hal yang bikin senang pas kamu lagi sedih apa?",
  "Pernah cinta bertepuk sebelah tangan? Kalau pernah, sama siapa? Rasanya gimana?",
  "Pernah jadi selingkuhan orang?",
  "Hal yang paling ditakuti?",
  "Siapa orang yang paling berpengaruh pada kehidupanmu?",
  "Hal membanggakan apa yang kamu dapatkan di tahun ini?",
  "Siapa orang yang bisa membuatmu sange?",
  "Siapa orang yang pernah buatmu sange?",
  "(Bagi yang muslim) pernah nggak salat seharian?",
  "Siapa yang paling mendekati tipe pasangan idealmu di sini?",
  "Suka mabar (main bareng) sama siapa?",
  "Pernah nolak orang? Alasannya kenapa?",
  "Sebutkan kejadian yang bikin kamu sakit hati yang masih diingat!",
  "Pencapaian yang sudah didapat apa aja di tahun ini?",
  "Kebiasaan terburukmu pas di sekolah apa?",
];

// Fungsi untuk menangani pesan
async function handle(sock, messageInfo) {
  const { remoteJid, message } = messageInfo;

  // Pilih truth secara acak
  const selectedTruth = truths[Math.floor(Math.random() * truths.length)];

  // Kirim pesan dengan gambar dan caption
  await sock.sendMessage(
    remoteJid,
    {
      image: buffer,
      caption: `*Truth*\n\n${selectedTruth}`,
    },
    { quoted: message }
  );
}
export default {
  handle,
  Commands: ["truth"],
  OnlyPremium: false,
  OnlyOwner: false,
};
