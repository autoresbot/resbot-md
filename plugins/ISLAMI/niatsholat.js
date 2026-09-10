// Data niat sholat
const niatShalat = {
  subuh: {
    sendiri: `أُصَلِّى فَرْضَ الصُّبْح رَكَعتَيْنِ مُسْتَقْبِلَ الْقِبْلَةِ أَدَاءً لله تَعَالَى.

"Ushallii fardash-Shubhi rak’ataini mustaqbilal qiblati adaa’an lillaahi ta’aalaa."

Artinya: Saya (berniat) mengerjakan sholat fardhu subuh sebanyak dua raka’at dengan menghadap kiblat, karena Allah Ta’ala.`,
    makmum: `أُصَلِّى فَرْضَ الصُّبْح رَكَعتَيْنِ مُسْتَقْبِلَ الْقِبْلَةِ أَدَاءً (مَأْمُوْمًا/إِمَامًا) لله تَعَالَى.

"Ushallii fardhash-Shubhi rak’ataini mustaqbilal qiblati makmuuman lillaahi ta’aalaa."

Artinya: Saya (berniat) mengerjakan sholat fardhu subuh sebanyak dua raka’at dengan menghadap kiblat, sebagai makmum, karena Allah Ta’ala.`,
  },
  dzuhur: {
    sendiri: `أُصَلِّى فَرْضَ الظُّهْرِ أَرْبَعَ رَكَعَاتٍ مُسْتَقْبِلَ الْقِبْلَةِ أَدَاءً لِلَّهِ تَعَالَى

(Ushollii fardhodz dzuhri arba’a roka’aatin mustaqbilal qiblati adaa’an lillaahi ta’aalaa)

Artinya:
Aku niat sholat fardhu Dzuhur empat raka’at, menghadap kilbat, saat ini karena Allah Ta’ala.`,
    makmum: `أُصَلِّى فَرْضَ الظُّهْرِ أَرْبَعَ رَكَعَاتٍ مُسْتَقْبِلَ الْقِبْلَةِ أَدَاءً مَأْمُوْمًا لِلَّهِ تَعَالَى

(Ushollii fardhodz dzuhri arba’a roka’aatin mustaqbilal qiblati adaa’an ma’muuman lillaahi ta’aalaa)

Artinya:
Aku niat sholat fardhu Dzuhur empat raka’at, menghadap kilbat, saat ini sebagai makmum karena Allah Ta’ala.`,
  },
  ashar: {
    sendiri: `أُصَلِّى فَرْضَ الْعَصْرِ أَرْبَعَ رَكَعَاتٍ مُسْتَقْبِلَ الْقِبْلَةِ أَدَاءً لِلَّهِ تَعَالَى


(Ushollii fardhol ‘ashri arba’a roka’aatin mustaqbilal qiblati adaa’an lillaahi ta’aalaa)


Artinya:
Aku niat sholat fardhu Ashar empat raka’at, menghadap kilbat, saat ini karena Allah Ta’ala.`,
    makmum: `أُصَلِّى فَرْضَ الْعَصْرِ أَرْبَعَ رَكَعَاتٍ مُسْتَقْبِلَ الْقِبْلَةِ أَدَاءً مَأْمُوْمًا لِلَّهِ تَعَالَى


(Ushollii fardhol ‘ashri arba’a roka’aatin mustaqbilal qiblati adaa’an ma’muuman lillaahi ta’aalaa)

Artinya:
Aku niat sholat fardhu Ashar empat raka’at, menghadap kilbat, saat ini sebagai makmum karena Allah Ta’ala.
`,
  },
  maghrib: {
    sendiri: `أُصَلِّى فَرْضَ الْمَغْرِبِ ثَلَاثَ رَكَعَاتٍ مُسْتَقْبِلَ الْقِبْلَةِ أَدَاءً لِلَّهِ تَعَالَى

(Ushollii fardhol maghribi tsalaatsa roka’aatin mustaqbilal qiblati adaa’an lillaahi ta’aalaa)

Artinya:
Aku niat sholat fardhu Maghrib tiga raka’at, menghadap kilbat, saat ini karena Allah Ta’ala.`,
    makmum: `أُصَلِّى فَرْضَ الْمَغْرِبِ ثَلَاثَ رَكَعَاتٍ مُسْتَقْبِلَ الْقِبْلَةِ أَدَاءً مَأْمُوْمًا لِلَّهِ تَعَالَى


(Ushollii fardhol maghribi tsalaatsa roka’aatin mustaqbilal qiblati adaa’an ma’muuman lillaahi ta’aalaa)

Artinya:
Aku niat sholat fardhu Maghrib tiga raka’at, menghadap kilbat, saat ini sebagai makmum karena Allah Ta’ala.`,
  },
  isya: {
    sendiri: `أُصَلِّى فَرْضَ الْعِشَاءِ أَرْبَعَ رَكَعَاتٍ مُسْتَقْبِلَ الْقِبْلَةِ أَدَاءً لِلَّهِ تَعَالَى

(Ushollii fardhol ‘isyaa’i arba’a roka’aatin mustaqbilal qiblati adaa’an lillaahi ta’aalaa)

Artinya:
Aku niat sholat fardhu Isya empat raka’at, menghadap kilbat, saat ini karena Allah Ta’ala.`,
    makmum: `أُصَلِّى فَرْضَ الْعِشَاءِ أَرْبَعَ رَكَعَاتٍ مُسْتَقْبِلَ الْقِبْلَةِ أَدَاءً مَأْمُوْمًا لِلَّهِ تَعَالَى

(Ushollii fardhol ‘isyaa’i arba’a roka’aatin mustaqbilal qiblati adaa’an ma’muuman lillaahi ta’aalaa)

Artinya:
Aku niat sholat fardhu Isya empat raka’at, menghadap kilbat, saat ini sebagai makmum karena Allah Ta’ala.`,
  },
};

function getGreeting() {
  const now = new Date();
  const utcHours = now.getUTCHours(); // Jam UTC
  const wibHours = (utcHours + 7) % 24; // Konversi ke WIB

  let greeting = "";
  let waktuShalat = "";
  let icon = ""; // Tambahkan variabel untuk ikon

  if (wibHours >= 4 && wibHours < 12) {
    greeting = "Selamat pagi!";
    waktuShalat = "subuh";
    icon = "🌅"; // Ikon untuk pagi
  } else if (wibHours >= 12 && wibHours < 15) {
    greeting = "Selamat siang!";
    waktuShalat = "dzuhur";
    icon = "☀️"; // Ikon untuk siang
  } else if (wibHours >= 15 && wibHours < 18) {
    greeting = "Selamat sore!";
    waktuShalat = "ashar";
    icon = "🌇"; // Ikon untuk sore
  } else if (wibHours >= 18 && wibHours < 19) {
    greeting = "Selamat petang!";
    waktuShalat = "maghrib";
    icon = "🌆"; // Ikon untuk petang
  } else {
    greeting = "Selamat malam!";
    waktuShalat = "isya";
    icon = "🌙"; // Ikon untuk malam
  }

  return { greeting: `${icon} ${greeting}`, waktuShalat };
}

// Fungsi untuk menangani perintah
async function handle(sock, messageInfo) {
  const { remoteJid, message, content } = messageInfo;
  const { greeting, waktuShalat: defaultWaktuShalat } = getGreeting();

  let waktuShalat = defaultWaktuShalat;

  // Tentukan waktu shalat berdasarkan input pengguna
  if (content === "subuh") {
    waktuShalat = "subuh";
  } else if (content === "dzuhur" || content === "zuhur") {
    waktuShalat = "dzuhur";
  } else if (content === "ashar" || content === "asar") {
    waktuShalat = "ashar";
  } else if (content === "maghrib" || content === "magrib") {
    waktuShalat = "maghrib";
  } else if (content === "isya") {
    waktuShalat = "isya";
  }

  const niat = niatShalat[waktuShalat];
  if (niat) {
    const pesan = `${greeting}\n\n_Berikut adalah niat sholat ${waktuShalat} (sendiri)_:\n\n${niat.sendiri}\n---------------\n\n_Niat sholat ${waktuShalat} (makmum)_:\n\n${niat.makmum}`;
    await sock.sendMessage(remoteJid, { text: pesan }, { quoted: message });
  } else {
    await sock.sendMessage(
      remoteJid,
      { text: "Waktu sholat tidak ditemukan atau belum ditentukan." },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["niatsholat", "niatshalat"],
  OnlyPremium: false,
  OnlyOwner: false,
};
