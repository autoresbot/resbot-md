import { forceConvertToM4a } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;

  // Tampilkan petunjuk penggunaan jika tidak ada konten
  if (!content) {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
          prefix + command
        } 1*_`,
      },
      { quoted: message }
    );
  }

  // Daftar nama surah
  const surahData = [
    "Al-Fatihah",
    "Al-Baqarah",
    "Ali Imran",
    "An Nisa",
    "Al-Ma'idah",
    "Al-An'am",
    "Al-A'raf",
    "Al-Anfal",
    "At-Taubah",
    "Yunus",
    "Hud",
    "Yusuf",
    "Ar-Ra'd",
    "Ibrahim",
    "Al-Hijr",
    "An-Nahl",
    "Al-Isra",
    "Al-Kahf",
    "Maryam",
    "Ta Ha",
    "Al-Anbiya",
    "Al-Hajj",
    "Al-Mu'minun",
    "An-Nur",
    "Al-Furqan",
    "Ash-Shu'ara",
    "An-Naml",
    "Al-Qasas",
    "Al-'Ankabut",
    "Ar-Rum",
    "Luqman",
    "As-Sajda",
    "Al-Ahzab",
    "Saba",
    "Fatir",
    "Ya Sin",
    "As-Saffat",
    "Sad",
    "Az-Zumar",
    "Ghafir",
    "Fussilat",
    "Ash-Shura",
    "Az-Zukhruf",
    "Ad-Dukhan",
    "Al-Jathiya",
    "Al-Ahqaf",
    "Muhammad",
    "Al-Fath",
    "Al-Hujurat",
    "Qaf",
    "Adh-Dhariyat",
    "At-Tur",
    "An-Najm",
    "Al-Qamar",
    "Ar-Rahman",
    "Al-Waqi'a",
    "Al-Hadid",
    "Al-Mujadila",
    "Al-Hashr",
    "Al-Mumtahina",
    "As-Saff",
    "Al-Jumu'a",
    "Al-Munafiqun",
    "At-Taghabun",
    "At-Talaq",
    "At-Tahrim",
    "Al-Mulk",
    "Al-Qalam",
    "Al-Haaqqa",
    "Al-Ma'arij",
    "Nuh",
    "Al-Jinn",
    "Al-Muzzammil",
    "Al-Muddathir",
    "Al-Qiyama",
    "Al-Insan",
    "Al-Mursalat",
    "An-Naba",
    "An-Nazi'at",
    "Abasa",
    "At-Takwir",
    "Al-Infitar",
    "Al-Mutaffifin",
    "Al-Inshiqaq",
    "Al-Buruj",
    "At-Tariq",
    "Al-Ala",
    "Al-Ghashiya",
    "Al-Fajr",
    "Al-Balad",
    "Ash-Shams",
    "Al-Lail",
    "Adh-Dhuha",
    "Ash-Sharh",
    "At-Tin",
    "Al-Alaq",
    "Al-Qadr",
    "Al-Bayyina",
    "Az-Zalzala",
    "Al-Adiyat",
    "Al-Qaria",
    "At-Takathur",
    "Al-Asr",
    "Al-Humazah",
    "Al-Fil",
    "Quraish",
    "Al-Ma'un",
    "Al-Kawthar",
    "Al-Kafirun",
    "An-Nasr",
    "Al-Masad",
    "Al-Ikhlas",
    "Al-Falaq",
    "An-Nas",
  ];

  // Cari nomor surah berdasarkan input
  const surahName = content.trim().toLowerCase();
  const surahIndex = surahData.findIndex(
    (surah) => surah.toLowerCase() === surahName
  );
  let surahNumber = content;

  if (surahIndex !== -1) {
    // Jika input adalah nama surah
    surahNumber = surahIndex + 1;
  } else if (isNaN(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    // Validasi jika input adalah nomor surah
    return await sock.sendMessage(
      remoteJid,
      { text: `⚠️ _Masukkan nomor surah dari 1 hingga 114_` },
      { quoted: message }
    );
  }

  surahNumber = surahNumber.toString().padStart(3, "0");

  await sock.sendMessage(remoteJid, {
    react: { text: "⏰", key: message.key },
  });

  try {
    const audioUrl = `https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/${surahNumber}.mp3`;
    const output = await forceConvertToM4a({
      url: audioUrl,
    });

    await sock.sendMessage(
      remoteJid,
      {
        audio: { url: output },
        fileName: `surah.m4a`,
        mimetype: "audio/mp4",
      },
      { quoted: message }
    );
  } catch (e) {
    console.error("Error sending Surah audio:", e);
    return await sock.sendMessage(remoteJid, {
      react: { text: "⛔", key: message.key },
    });
  }
}
export default {
  handle,
  Commands: ["surah", "suroh"],
  OnlyPremium: false,
  OnlyOwner: false,
};
