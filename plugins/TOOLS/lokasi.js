import axios from "axios";

import { reply } from "../../lib/utils.js";
import { logCustom } from "../../lib/logger.js";

// Data peta dari OpenStreetMap (Nominatim): gratis dan tanpa API key.
// Syarat pemakaiannya: wajib ada User-Agent yang jelas dan maksimal 1 request
// per detik, jadi pencarian diberi jarak supaya bot tidak diblokir.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "resbot-md (https://autoresbot.com)";
const JEDA_MS = 1100;

let antrean = Promise.resolve();
let terakhir = 0;

function cariLokasi(kataKunci) {
  const hasil = antrean.then(async () => {
    const tunggu = terakhir + JEDA_MS - Date.now();
    if (tunggu > 0) await new Promise((resolve) => setTimeout(resolve, tunggu));
    terakhir = Date.now();

    const { data } = await axios.get(NOMINATIM_URL, {
      params: {
        q: kataKunci,
        format: "jsonv2",
        addressdetails: 1,
        extratags: 1,
        limit: 1,
        "accept-language": "id",
      },
      headers: { "User-Agent": USER_AGENT },
      timeout: 20000,
    });
    return Array.isArray(data) ? data[0] : null;
  });
  antrean = hasil.catch(() => {});
  return hasil;
}

function susunTeks(tempat) {
  const lat = Number(tempat.lat);
  const lon = Number(tempat.lon);
  const alamat = tempat.address ?? {};
  const info = tempat.extratags ?? {};
  const nama = tempat.name || tempat.display_name.split(",")[0];

  const baris = [`📍 *${nama}*`, "", `🏠 *Alamat:* ${tempat.display_name}`];

  const kota =
    alamat.city || alamat.town || alamat.village || alamat.county || alamat.city_district;
  if (kota) baris.push(`🏙️ *Kota/Kab:* ${kota}`);
  if (alamat.state && alamat.state !== kota) baris.push(`🗾 *Provinsi:* ${alamat.state}`);
  if (alamat.country) baris.push(`🌏 *Negara:* ${alamat.country}`);
  if (alamat.postcode) baris.push(`📮 *Kode Pos:* ${alamat.postcode}`);
  if (tempat.type) baris.push(`🏷️ *Jenis:* ${String(tempat.type).replace(/_/g, " ")}`);
  if (info.opening_hours) baris.push(`🕒 *Jam Buka:* ${info.opening_hours}`);
  const telepon = info.phone || info["contact:phone"];
  if (telepon) baris.push(`📞 *Telepon:* ${telepon}`);
  const website = info.website || info["contact:website"];
  if (website) baris.push(`🌐 *Website:* ${website}`);
  baris.push(`🧭 *Koordinat:* ${lat}, ${lon}`);

  // Link pertama mencari NAMA tempatnya di Google Maps (membuka halaman
  // tempat lengkap dengan foto/ulasan), link kedua menunjuk titik pastinya.
  baris.push(
    "",
    "🗺️ *Google Maps:*",
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tempat.display_name)}`,
    "",
    "📌 *Titik Koordinat:*",
    `https://maps.google.com/?q=${lat},${lon}`
  );

  return { teks: baris.join("\n"), lat, lon, nama };
}

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, prefix, command, content } = messageInfo;

  try {
    const kataKunci = (content || "").trim();
    if (!kataKunci) {
      return await reply(
        m,
        `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${prefix + command} jakarta*_\n_💬 Contoh:_ _*${
          prefix + command
        } monas jakarta*_`
      );
    }

    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const tempat = await cariLokasi(kataKunci);
    if (!tempat) {
      return await reply(
        m,
        `_❌ Lokasi "${kataKunci}" tidak ditemukan._\n\n_Coba tulis lebih lengkap, misalnya nama tempat + kota._`
      );
    }

    const { teks, lat, lon, nama } = susunTeks(tempat);
    await reply(m, teks);

    // Pin lokasi hanyalah pelengkap; kalau gagal, teksnya sudah terkirim.
    try {
      await sock.sendMessage(
        remoteJid,
        {
          location: {
            degreesLatitude: lat,
            degreesLongitude: lon,
            name: nama,
            address: tempat.display_name,
          },
        },
        { quoted: message }
      );
    } catch (err) {
      console.error("Gagal mengirim pin lokasi:", err.message);
    }
  } catch (error) {
    console.error("Error in handle function:", error);
    logCustom("info", content, `ERROR-COMMAND-${command}.txt`);
    const pesan =
      error.response?.status === 429
        ? "Server peta sedang sibuk, coba lagi sebentar."
        : error.message;
    await sock.sendMessage(
      remoteJid,
      { text: `_Error: ${pesan}_` },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["lokasi", "maps"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
