import axios from "axios";
import * as cheerio from "cheerio";

/**
 * Mengunduh metadata video TikTok
 * @param {string} url - URL video TikTok
 * @returns {Promise<Object>} Metadata video termasuk judul, cover, link video, dan audio
 */
async function tiktok(url) {
  return new Promise(async (resolve, reject) => {
    try {
      // Menyiapkan parameter untuk request
      const params = new URLSearchParams();
      params.set("url", url);
      params.set("hd", "1");

      // Mengirim permintaan ke Tikwm API
      const response = await axios({
        method: "POST",
        url: "https://tikwm.com/api/",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Cookie: "current_language=en",
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
        },
        data: params,
      });

      const data = response.data.data;

      // Memastikan data tersedia
      if (!data) {
        throw new Error(
          "Data video TikTok tidak ditemukan atau respons tidak valid."
        );
      }

      // Resolusi dengan data video
      resolve({
        title: data.title,
        cover: data.cover,
        origin_cover: data.origin_cover,
        no_watermark: data.play,
        watermark: data.wmplay,
        music: data.music,
      });
    } catch (error) {
      // Menangkap kesalahan dan menolaknya
      reject(
        new Error(`Gagal mendapatkan data video TikTok: ${error.message}`)
      );
    }
  });
}

async function tiktokSearch(keywords) {
  try {
    const response = await axios({
      method: "POST",
      url: "https://tikwm.com/api/feed/search",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Cookie: "current_language=en",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
      },
      data: {
        keywords: keywords,
        count: 50,
        cursor: 0,
        HD: 1,
      },
    });

    const videos = response?.data?.data?.videos;

    if (!videos || videos.length === 0) {
      throw new Error("Tidak ada video ditemukan.");
    }

    const selectedVideo = videos[Math.floor(Math.random() * videos.length)];

    return {
      title: selectedVideo.title,
      cover: selectedVideo.cover,
      origin_cover: selectedVideo.origin_cover,
      no_watermark: selectedVideo.play,
      watermark: selectedVideo.wmplay,
      music: selectedVideo.music,
    };
  } catch (error) {
    throw new Error(`Gagal mencari video: ${error.message}`);
  }
}

async function ttslide(url) {
  try {
    const response = await axios.get(
      `https://dlpanda.com/id?url=${url}&token=G7eRpMaa`
    );
    const html = response.data;

    const $ = cheerio.load(html);
    const images = [];
    const creator = "Jikarinka";

    // Ekstraksi URL gambar
    $("div.col-md-12 > img").each((_, element) => {
      const imgSrc = $(element).attr("src");
      if (imgSrc) {
        images.push(imgSrc);
      }
    });

    if (images.length === 0) {
      throw new Error("Tidak ada gambar yang ditemukan.");
    }

    // Struktur hasil
    return {
      creator,
      images: images.map((img) => ({ img, creator })),
    };
  } catch (error) {
    throw new Error(`Gagal memproses URL: ${error.message}`);
  }
}

// Link TikTok di dalam teks, boleh tanpa https:// (mis. "vm.tiktok.com/ZSxxx").
const POLA_LINK_TIKTOK = /(?:https?:\/\/)?(?:[\w-]+\.)*tiktok\.com\/[^\s]*/i;
// Link akhir yang diterima API: www.tiktok.com/@user/video/<id> atau /photo/<id>.
const POLA_LINK_AKHIR = /^https:\/\/www\.tiktok\.com\/@[^/]*\/(?:video|photo)\/\d+/i;

/**
 * Ambil link TikTok dari teks lalu ikuti redirect-nya sampai ke link
 * www.tiktok.com/@user/video/<id>. API menolak link pendek vm.tiktok.com
 * dan m.tiktok.com ("URL harus dari TikTok"), jadi link ini yang dikirim.
 *
 * @param {string} text isi pesan
 * @returns {Promise<string|null>} link akhir tanpa query, atau null kalau
 *   tidak ada link TikTok di teks
 * @throws {Error} kalau link tidak mengarah ke video/foto (salah / dihapus)
 */
async function resolveTiktokUrl(text) {
  const cocok = String(text || '').match(POLA_LINK_TIKTOK);
  if (!cocok) return null;

  let url = /^https?:\/\//i.test(cocok[0]) ? cocok[0] : `https://${cocok[0]}`;

  for (let i = 0; i < 5 && !POLA_LINK_AKHIR.test(url); i++) {
    const res = await axios.head(url, {
      maxRedirects: 0,
      timeout: 15000,
      validateStatus: () => true,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
      },
    });
    const lokasi = res.headers?.location;
    if (res.status < 300 || res.status >= 400 || !lokasi) break;
    url = new URL(lokasi, url).href;
  }

  if (!POLA_LINK_AKHIR.test(url)) {
    throw new Error('Link TikTok tidak valid, atau videonya sudah dihapus / private.');
  }

  // Buang ?_r=1&_t=... dari link bagikan, tidak dibutuhkan API.
  return url.split('?')[0];
}

export { tiktok, tiktokSearch, ttslide, resolveTiktokUrl };
