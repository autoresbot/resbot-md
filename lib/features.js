import axios from "axios";

let cachedJadwalSholat = null;

function kurangiMenit(waktu, menitDikurangi) {
  let [jam, menit] = waktu.split(":").map(Number);
  let totalMenit = jam * 60 + menit - menitDikurangi;

  let newJam = Math.floor(totalMenit / 60);
  let newMenit = totalMenit % 60;

  return `${String(newJam).padStart(2, "0")}:${String(newMenit).padStart(
    2,
    "0"
  )}`;
}

async function getJadwalSholat(kota = "jakarta") {
  try {
    // Jika data sudah di-cache, kembalikan data tersebut
    if (cachedJadwalSholat) {
      return cachedJadwalSholat;
    }

    const url = `https://api.autoresbot.com/api/jadwalsholat?kota=${kota}`;

    // Memanggil API untuk mendapatkan data jadwal sholat
    const response = await axios.get(url);

    if (!response || response.status !== 200) {
      throw new Error("Gagal mendapatkan data jadwal sholat.");
    }

    // Simpan data ke dalam cache

    const { subuh, dzuhur, ashar, maghrib, isya } = response.data.data.jadwal;

    const sahur = kurangiMenit(subuh, 60); // waktu sahur dari 1 jam sebelum subuh

    // Objek jadwal
    const jadwalLokal = { subuh, dzuhur, ashar, maghrib, isya };

    cachedJadwalSholat = Object.fromEntries(
      Object.entries(jadwalLokal).map(([key, value]) => [key, value])
    );
    return cachedJadwalSholat;
  } catch (error) {
    console.error("Error in getJadwalSholat:", error.message);
    throw new Error("Gagal mendapatkan waktu sholat");
  }
}

async function textToAudio(text) {
  try {
    // Validasi input
    if (!text || typeof text !== "string") {
      throw new Error("Teks harus berupa string yang valid.");
    }

    // Potong teks menjadi maksimal 199 karakter
    const maxLength = 190; // Batas aman
    const truncatedText = text.slice(0, maxLength).trim();

    // URL layanan Google Translate TTS
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${truncatedText}&tl=id&client=tw-ob`;

    // Mendapatkan data audio dari URL
    const response = await axios({
      method: "get",
      url: url,
      responseType: "arraybuffer",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    // Periksa apakah audio diterima
    if (!response || response.status !== 200) {
      throw new Error("Gagal mendapatkan audio dari Google Translate TTS.");
    }

    return Buffer.from(response.data);
  } catch (error) {
    console.error("Error in textToAudio:", error.message);
    throw new Error("Gagal mengubah teks menjadi audio.");
  }
}
export { textToAudio, getJadwalSholat };
