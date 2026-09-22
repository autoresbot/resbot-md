import fs from 'fs';
import os from 'os';
const { tmpdir } = os;
import crypto from 'crypto';
import ff from 'fluent-ffmpeg';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import webp from 'node-webpmux';
import path from 'path';
import FileType from 'file-type';

ff.setFfmpegPath(ffmpegPath);

/**
 * Hapus berkas sementara di tmpdir, diam-diam bila sudah tidak ada.
 *
 * Semua konversi di sini menulis ke `os.tmpdir()` (biasanya /tmp), dan folder
 * itu TIDAK ikut dibersihkan oleh clearDirectory('./tmp') di index.js. Berkas
 * yang tertinggal — hasil stiker yang sudah terkirim, atau sisa konversi yang
 * gagal di tengah jalan — menumpuk terus sampai disk panel penuh dan semua
 * penulisan gagal dengan "ENOSPC: no space left on device". Stiker animasi
 * (.bratdeluxe dkk) yang paling cepat kena karena berkasnya paling besar.
 */
function hapusSementara(...berkas) {
  for (const file of berkas) {
    if (typeof file !== 'string') continue;
    try {
      fs.unlinkSync(file);
    } catch {
      // sudah terhapus / tidak pernah terbentuk — tidak perlu menggagalkan apa pun
    }
  }
}

async function gifToWebp(media) {
  const tmpFileOut = path.join(
    os.tmpdir(),
    `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`,
  );
  const tmpFileIn = path.join(
    os.tmpdir(),
    `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.gif`,
  );

  try {
    // Menulis buffer GIF ke file sementara
    fs.writeFileSync(tmpFileIn, media);

    // Menjalankan konversi GIF ke WebP menggunakan FFmpeg
    await new Promise((resolve, reject) => {
      ff(tmpFileIn)
        .on('error', reject)
        .on('end', () => resolve(true))
        .outputOptions([
          '-vcodec',
          'libwebp',
          '-vf',
          'fps=15,scale=320:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
        ])
        .toFormat('webp')
        .save(tmpFileOut);
    });

    // Membaca file WebP yang dihasilkan menjadi buffer
    return fs.readFileSync(tmpFileOut);
  } catch (error) {
    // Menangani kesalahan di sini
    console.error('Terjadi kesalahan:', error);
    throw error;
  } finally {
    hapusSementara(tmpFileIn, tmpFileOut);
  }
}

async function webpToImage(webpData) {
  const tmpFileOut = path.join(
    tmpdir(),
    `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.jpg`,
  );
  const tmpFileIn = path.join(
    tmpdir(),
    `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`,
  );

  try {
    fs.writeFileSync(tmpFileIn, webpData);

    await new Promise((resolve, reject) => {
      ff(tmpFileIn)
        .on('error', reject)
        .on('end', () => resolve(true))
        .addOutputOptions([
          '-vcodec',
          'mjpeg', // Menggunakan codec MJPEG untuk JPG
          '-q:v',
          '2', // Kualitas gambar (0-2), semakin kecil semakin tinggi kualitasnya
          '-vf',
          'fps=15', // Frame rate (opsional, sesuaikan dengan kebutuhan Anda)
        ])
        .toFormat('image2')
        .save(tmpFileOut);
    });

    return fs.readFileSync(tmpFileOut);
  } finally {
    hapusSementara(tmpFileIn, tmpFileOut);
  }
}

/** Ukuran stiker standar WhatsApp. */
const UKURAN_STIKER = 512;

/**
 * Siapkan sumber yang SUDAH webp menjadi stiker 512x512.
 *
 * Tidak lewat ffmpeg, karena ffmpeg tidak bisa men-decode webp ANIMASI
 * ("Invalid data found when processing input") — dan kalaupun bisa,
 * animasinya ikut rata jadi satu frame. `sharp` dengan `{ animated: true }`
 * me-resize seluruh frame sekaligus.
 */
/**
 * Baca daftar frame (chunk ANMF) dari webp animasi: posisi, ukuran, dan durasi.
 * Dipakai oleh bersihkanSisaFrameWebp — lihat catatan panjang di sana.
 */
function bacaFrameWebp(media) {
  const frames = [];
  if (!Buffer.isBuffer(media) || media.length < 12) return frames;
  if (media.toString('ascii', 8, 12) !== 'WEBP') return frames;

  let off = 12;
  while (off + 8 <= media.length) {
    const tag = media.toString('ascii', off, off + 4);
    const size = media.readUInt32LE(off + 4);
    if (tag === 'ANMF' && off + 8 + 16 <= media.length) {
      const p = off + 8;
      frames.push({
        // Offset frame disimpan dalam kelipatan 2 piksel, ukurannya minus satu.
        x: media.readUIntLE(p, 3) * 2,
        y: media.readUIntLE(p + 3, 3) * 2,
        w: media.readUIntLE(p + 6, 3) + 1,
        h: media.readUIntLE(p + 9, 3) + 1,
        durasi: media.readUIntLE(p + 12, 3),
      });
    }
    off += 8 + size + (size % 2);
    if (size === 0) break; // chunk rusak — jangan berputar selamanya
  }
  return frames;
}

/** Seberapa besar bagian gambar yang harus dicakup frame terakhir sebelum
 *  frame itu dianggap "menggambar ulang semuanya". Lihat bersihkanSisaFrameWebp. */
const AMBANG_GAMBAR_ULANG = 0.9;

/**
 * Bersihkan sisa gambar pada webp animasi yang frame-nya menggambar sebagian
 * kanvas saja.
 *
 * Frame webp animasi boleh berupa kotak kecil di posisi tertentu, dan dengan
 * dispose-none piksel di LUAR kotak itu dibiarkan apa adanya dari frame
 * sebelumnya. Kalau frame terakhir kotaknya lebih kecil/bergeser dari frame
 * sebelumnya, potongan gambar lama di luar kotak tidak pernah tertimpa dan
 * tertinggal di kanvas — muncul sebagai garis/serpihan kecil di sekitar objek
 * utama, dan menetap karena stiker berhenti di frame terakhir.
 *
 * Itu yang terjadi pada hasil `.bratdeluxe`: frame terakhir digambar di
 * y=206 sementara frame sebelumnya di y=204, menyisakan sepotong garis satu
 * piksel tepat di atas teks.
 *
 * Perbaikannya: frame terakhir diganti satu frame SEPENUH kanvas berisi
 * gambar yang sudah bersih, jadi apa pun sisa dari frame sebelumnya tertimpa.
 * Frame-frame lain tidak disentuh — animasinya tetap seperti aslinya.
 *
 * Pengamannya `AMBANG_GAMBAR_ULANG`: perbaikan hanya dijalankan bila frame
 * terakhir memang memuat hampir seluruh gambar. Pada animasi yang SENGAJA
 * bertumpuk (frame terakhir cuma menambah bagian kecil, misal titik berkedip),
 * menimpa sepenuh kanvas justru akan menghapus gambar — kasus itu dilewati.
 */
async function bersihkanSisaFrameWebp(media) {
  try {
    const frames = bacaFrameWebp(media);
    if (frames.length < 2) return media; // bukan animasi / tidak ada yang bisa tertinggal

    const sharp = (await import('sharp')).default;
    const meta = await sharp(media, { animated: true }).metadata();
    const W = meta.width;
    const H = meta.pageHeight || meta.height;
    if (!W || !H) return media;

    const menutupKanvas = (r) => r.x === 0 && r.y === 0 && r.w >= W && r.h >= H;

    const terakhir = frames[frames.length - 1];
    // Frame terakhir sudah sepenuh kanvas -> tidak mungkin ada yang tertinggal.
    if (menutupKanvas(terakhir)) return media;

    const ambilFrame = async (n) => {
      const { data, info } = await sharp(media, { page: n })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      // sharp menaruh kotak frame pada kanvas penuh; kalau ukurannya di luar
      // dugaan, lebih baik mundur daripada menyalin ke posisi yang salah.
      return info.width === W && info.height === H ? data : null;
    };

    // Pelat dasar: frame pertama bila ia sepenuh kanvas, kalau tidak kanvas
    // kosong (perilaku bawaan webp animasi).
    const pertamaPenuh = menutupKanvas(frames[0]);
    const pelat = pertamaPenuh ? await ambilFrame(0) : Buffer.alloc(W * H * 4, 0);
    if (!pelat) return media;

    // Salin HANYA kotak milik frame tsb, meniru pemutar webp (dispose-none).
    const tempel = (tujuan, sumber, r) => {
      const lebar = Math.min(r.w, W - r.x);
      if (lebar <= 0) return;
      for (let yy = 0; yy < r.h; yy++) {
        const Y = r.y + yy;
        if (Y >= H) break;
        const awal = (Y * W + r.x) * 4;
        sumber.copy(tujuan, awal, awal, awal + lebar * 4);
      }
    };

    // Kanvas hasil animasi sebenarnya (berikut sisa-sisanya).
    const kanvas = Buffer.from(pelat);
    let dataTerakhir = null;
    for (let n = pertamaPenuh ? 1 : 0; n < frames.length; n++) {
      const data = await ambilFrame(n);
      if (!data) return media;
      tempel(kanvas, data, frames[n]);
      if (n === frames.length - 1) dataTerakhir = data;
    }
    if (!dataTerakhir) return media;

    // Kanvas versi bersih: pelat dasar + isi frame terakhir saja.
    const bersih = Buffer.from(pelat);
    tempel(bersih, dataTerakhir, terakhir);

    // "Tinta" = piksel yang berbeda dari pelat dasar.
    let total = 0;
    let didalam = 0;
    for (let y = 0; y < H; y++) {
      const baris = y * W;
      const dalamBarisTerakhir = y >= terakhir.y && y < terakhir.y + terakhir.h;
      for (let x = 0; x < W; x++) {
        const i = (baris + x) * 4;
        if (kanvas.readUInt32LE(i) === pelat.readUInt32LE(i)) continue;
        total++;
        if (dalamBarisTerakhir && x >= terakhir.x && x < terakhir.x + terakhir.w) didalam++;
      }
    }

    if (!total || total === didalam) return media; // tidak ada sisa di luar kotak
    if (didalam / total < AMBANG_GAMBAR_ULANG) return media; // animasi memang bertumpuk

    // LOSSLESS, bukan lossy: encode lossy pada gambar bertepi tajam (teks hitam
    // di atas putih) meninggalkan riak abu-abu samar di sekitar objek — persis
    // jenis noda yang sedang kita hilangkan. Cuma satu frame, jadi tambahan
    // ukurannya kecil.
    const webpBersih = await sharp(bersih, { raw: { width: W, height: H, channels: 4 } })
      .webp({ lossless: true, effort: 4 })
      .toBuffer();

    // Frame terakhir diganti langsung di level chunk RIFF, BUKAN lewat
    // `img.save()` node-webpmux. Pustaka itu menulis ulang header VP8X webp
    // animasi TANPA bit alpha (lihat sisipkanExif). Akibatnya pemutar stiker
    // WhatsApp menggambar kotak-kotak frame sebagai gambar tanpa transparansi,
    // dan data warna di bawah piksel transparan (sebagian gelap) muncul
    // sebagai titik/garis hitam kecil di sekitar teks .bratdeluxe dkk.
    const hasil = gantiFrameTerakhir(media, webpBersih, { durasi: terakhir.durasi });
    if (hasil) return hasil;

    // Cadangan: bentuk chunk di luar dugaan -> pakai node-webpmux, lalu bit
    // alpha dari berkas asli dipasang kembali.
    const img = new webp.Image();
    await img.load(media);
    // blend:false -> frame ini MENIMPA kanvas, bukan dicampur, jadi sisa lama hilang.
    img.frames[img.frames.length - 1] = await webp.Image.generateFrame({
      buffer: webpBersih,
      x: 0,
      y: 0,
      delay: terakhir.durasi,
      blend: false,
      dispose: false,
    });

    return pulihkanFlagAlpha(await img.save(null), media);
  } catch (error) {
    // Merapikan itu penyempurnaan, bukan syarat. Stiker asli lebih baik
    // terkirim apa adanya daripada gagal total.
    console.warn('[STICKER] Gagal merapikan webp animasi:', error?.message || error);
    return media;
  }
}

async function webpKeStiker(media) {
  // Rapikan dulu sisa frame (kalau ada) — ini juga berlaku untuk webp yang
  // ukurannya sudah pas, yang langsung keluar lewat `sudahPas` di bawah.
  const sumber = await bersihkanSisaFrameWebp(media);

  let sudahPas = false;
  try {
    const img = new webp.Image();
    await img.load(sumber);
    sudahPas = img.width === UKURAN_STIKER && img.height === UKURAN_STIKER;
  } catch {
    return sumber; // bukan webp yang bisa dibaca -> biarkan apa adanya
  }

  if (sudahPas) return sumber;

  try {
    const sharp = (await import('sharp')).default;
    return await sharp(sumber, { animated: true })
      .resize(UKURAN_STIKER, UKURAN_STIKER, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 75 })
      .toBuffer();
  } catch (error) {
    // sharp modul native — bisa gagal dimuat di panel. Lebih baik stiker
    // terkirim dengan ukuran aslinya daripada gagal sama sekali.
    console.warn('[STICKER] Resize webp gagal, dikirim apa adanya:', error?.message || error);
    return sumber;
  }
}

async function imageToWebp(media) {
  // Sumber yang sudah webp tidak di-encode ulang, hanya diseragamkan ukurannya.
  const tipeAsli = await FileType.fromBuffer(media);
  if (tipeAsli?.mime === 'image/webp') return webpKeStiker(media);

  const tmpFileOut = path.join(
    tmpdir(),
    `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`,
  );
  const tmpFileIn = path.join(
    tmpdir(),
    `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.jpg`,
  );

  try {
    fs.writeFileSync(tmpFileIn, media);

    await new Promise((resolve, reject) => {
      ff(tmpFileIn)
        .on('error', reject)
        .on('end', () => resolve(true))
        .addOutputOptions([
          '-vcodec',
          'libwebp',
          '-vf',
          // 512x512 adalah ukuran stiker standar WhatsApp. Sebelumnya 320x320,
          // dan stiker berukuran non-standar bisa terkirim tapi TIDAK BISA
          // disimpan ke koleksi stiker oleh penerima.
          "scale='min(512,iw)':min'(512,ih)':force_original_aspect_ratio=decrease,fps=15, pad=512:512:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse",
        ])
        .toFormat('webp')
        .save(tmpFileOut);
    });

    return fs.readFileSync(tmpFileOut);
  } finally {
    hapusSementara(tmpFileIn, tmpFileOut);
  }
}

async function videoToWebp(media) {
  const tmpFileOut = path.join(
    tmpdir(),
    `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`,
  );
  const tmpFileIn = path.join(
    tmpdir(),
    `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.mp4`,
  );

  try {
    fs.writeFileSync(tmpFileIn, media);

    await new Promise((resolve, reject) => {
      ff(tmpFileIn)
        .on('error', reject)
        .on('end', () => resolve(true))
        .addOutputOptions([
          '-vcodec',
          'libwebp',
          '-vf',
          // 512x512: ukuran stiker standar WhatsApp (lihat catatan di imageToWebp).
          "scale='min(512,iw)':min'(512,ih)':force_original_aspect_ratio=decrease,fps=15, pad=512:512:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse",
          '-loop',
          '0',
          '-ss',
          '00:00:00',
          '-t',
          '00:00:05',
          '-preset',
          'default',
          '-an',
          '-vsync',
          '0',
        ])
        .toFormat('webp')
        .save(tmpFileOut);
    });

    return fs.readFileSync(tmpFileOut);
  } finally {
    hapusSementara(tmpFileIn, tmpFileOut);
  }
}

/**
 * ID paket stiker — unik per kombinasi packname + author.
 *
 * Sebelumnya nilainya dipatok ke satu URL GitHub yang SAMA untuk semua stiker.
 * WhatsApp memakai id ini untuk mengelompokkan stiker ke dalam paket, jadi
 * id yang sama untuk semua paket membuat pengelompokannya kacau. `.wm`
 * (wa-sticker-formatter) memakai hash per paket, dan itu yang ditiru di sini.
 */
function packId(metadata = {}) {
  return crypto
    .createHash('sha256')
    .update(`${metadata.packname ?? ''}|${metadata.author ?? ''}`)
    .digest('hex');
}

/** Blok EXIF berisi identitas paket stiker yang dibaca WhatsApp. */
function bangunExif(metadata) {
  const json = {
    'sticker-pack-id': packId(metadata),
    'sticker-pack-name': metadata.packname,
    'sticker-pack-publisher': metadata.author,
    emojis: metadata.categories ? metadata.categories : [''],
  };
  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
  ]);
  const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8');
  const exif = Buffer.concat([exifAttr, jsonBuff]);
  exif.writeUIntLE(jsonBuff.length, 14, 4);
  return exif;
}

/** Bit "punya EXIF" dan "punya alpha" pada header VP8X. */
const VP8X_FLAG_EXIF = 0x08;

/** Pecah berkas webp menjadi daftar chunk RIFF. `null` bila bukan webp. */
function bacaChunkWebp(media) {
  if (media.length < 12) return null;
  if (media.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (media.toString('ascii', 8, 12) !== 'WEBP') return null;

  const chunks = [];
  let offset = 12;
  while (offset + 8 <= media.length) {
    const tag = media.toString('ascii', offset, offset + 4);
    const size = media.readUInt32LE(offset + 4);
    const akhir = offset + 8 + size + (size % 2); // chunk ganjil dipadding 1 byte
    if (akhir > media.length) return null; // berkas rusak/terpotong
    chunks.push({ tag, data: media.subarray(offset + 8, offset + 8 + size) });
    offset = akhir;
  }
  return chunks.length ? chunks : null;
}

/** Rangkai kembali daftar chunk menjadi berkas webp utuh. */
function susunChunkWebp(chunks) {
  const isi = Buffer.concat(
    chunks.flatMap(({ tag, data }) => {
      const header = Buffer.alloc(8);
      header.write(tag, 0, 'ascii');
      header.writeUInt32LE(data.length, 4);
      return data.length % 2 ? [header, data, Buffer.alloc(1)] : [header, data];
    }),
  );
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(4 + isi.length, 4);
  header.write('WEBP', 8, 'ascii');
  return Buffer.concat([header, isi]);
}

/** Bit "punya alpha" pada header VP8X. */
const VP8X_FLAG_ALPHA = 0x10;

/**
 * Pasang kembali bit alpha VP8X bila berkas asli memilikinya tapi hasil
 * olahan tidak. Piksel tidak disentuh, hanya satu bit di header.
 */
function pulihkanFlagAlpha(hasil, asli) {
  try {
    const vp8xAsli = bacaChunkWebp(asli)?.find((c) => c.tag === 'VP8X');
    if (!vp8xAsli || !(vp8xAsli.data[0] & VP8X_FLAG_ALPHA)) return hasil;

    const chunks = bacaChunkWebp(hasil);
    const vp8x = chunks?.find((c) => c.tag === 'VP8X');
    if (!vp8x || vp8x.data[0] & VP8X_FLAG_ALPHA) return hasil;

    const flags = Buffer.from(vp8x.data);
    flags[0] |= VP8X_FLAG_ALPHA;
    vp8x.data = flags;
    return susunChunkWebp(chunks);
  } catch {
    return hasil;
  }
}

/**
 * Ganti frame (ANMF) terakhir webp animasi dengan satu frame sepenuh kanvas
 * di posisi 0,0 yang MENIMPA kanvas (tanpa blend). Semua chunk lain — VP8X
 * beserta bit alpha-nya, ANIM, dan frame-frame sebelumnya — disalin apa adanya.
 *
 * @param {Buffer} media - webp animasi asli
 * @param {Buffer} webpFrame - webp diam berisi gambar pengganti
 * @returns {Buffer|null} `null` bila struktur berkas tidak sesuai dugaan
 */
function gantiFrameTerakhir(media, webpFrame, { durasi }) {
  const chunks = bacaChunkWebp(media);
  const sumber = bacaChunkWebp(webpFrame);
  if (!chunks || !sumber) return null;

  let posisi = -1;
  chunks.forEach((c, i) => {
    if (c.tag === 'ANMF') posisi = i;
  });
  if (posisi < 0) return null;

  // Hanya data gambar yang boleh masuk ke dalam ANMF.
  const isiGambar = sumber.filter((c) => ['ALPH', 'VP8 ', 'VP8L'].includes(c.tag));
  if (!isiGambar.some((c) => c.tag === 'VP8 ' || c.tag === 'VP8L')) return null;

  let lebar;
  let tinggi;
  const vp8l = isiGambar.find((c) => c.tag === 'VP8L');
  if (vp8l) {
    // Header VP8L: 1 byte signature 0x2f, lalu 14 bit lebar-1 dan 14 bit tinggi-1.
    const bits = vp8l.data.readUInt32LE(1);
    lebar = (bits & 0x3fff) + 1;
    tinggi = ((bits >> 14) & 0x3fff) + 1;
  } else {
    const vp8x = sumber.find((c) => c.tag === 'VP8X');
    if (!vp8x) return null;
    lebar = vp8x.data.readUIntLE(4, 3) + 1;
    tinggi = vp8x.data.readUIntLE(7, 3) + 1;
  }

  const header = Buffer.alloc(16);
  header.writeUIntLE(0, 0, 3); // x / 2
  header.writeUIntLE(0, 3, 3); // y / 2
  header.writeUIntLE(lebar - 1, 6, 3);
  header.writeUIntLE(tinggi - 1, 9, 3);
  header.writeUIntLE(Math.min(durasi ?? 0, 0xffffff), 12, 3);
  header[15] = 0x02; // bit1 = jangan blend (timpa), bit0 = dispose none

  const isi = susunChunkWebp(isiGambar).subarray(12); // buang header RIFF
  chunks[posisi] = { tag: 'ANMF', data: Buffer.concat([header, isi]) };
  return susunChunkWebp(chunks);
}

/**
 * Sisipkan EXIF langsung di level chunk RIFF — data gambarnya tidak disentuh
 * sama sekali.
 *
 * Alasannya: `node-webpmux` membongkar-pasang berkas saat `img.save()`, dan
 * untuk webp ANIMASI ia menulis ulang header VP8X tanpa bit alpha
 * (flag 0b00010010 -> 0b00000010). Semua piksel memang tetap sama, tapi
 * pemutar yang percaya pada flag itu menganggap stikernya tidak punya
 * transparansi, sehingga area transparan tampil sebagai putih — inilah
 * "border putih" yang muncul di stiker animasi (mis. .bratdeluxe) padahal
 * gambar dari API-nya bersih.
 *
 * @returns {Buffer|null} `null` bila bentuk berkasnya tidak cocok untuk cara
 *   ini (bukan webp, atau webp sederhana tanpa VP8X) — pemanggil harus
 *   memakai jalur node-webpmux sebagai cadangan.
 */
function sisipkanExif(media, exif) {
  const chunks = bacaChunkWebp(media);
  if (!chunks) return null;

  const vp8x = chunks.find((chunk) => chunk.tag === 'VP8X');
  if (!vp8x || vp8x.data.length < 1) return null;

  // EXIF lama dibuang; spesifikasi webp menaruh EXIF setelah data gambar.
  const hasil = chunks.filter((chunk) => chunk.tag !== 'EXIF');

  const flags = Buffer.from(vp8x.data);
  flags[0] |= VP8X_FLAG_EXIF;
  vp8x.data = flags;

  hasil.push({ tag: 'EXIF', data: exif });
  return susunChunkWebp(hasil);
}

/**
 * Tulis stiker webp beserta metadata paketnya ke berkas sementara.
 *
 * @returns {Promise<string|undefined>} path berkas hasil, atau `undefined`
 *   bila metadata paket tidak diisi (perilaku lama tetap dipertahankan).
 */
async function simpanDenganExif(wMedia, metadata) {
  if (!metadata.packname && !metadata.author) return undefined;

  const exif = bangunExif(metadata);
  const tmpFileOut = path.join(
    tmpdir(),
    `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`,
  );

  const utuh = sisipkanExif(wMedia, exif);
  if (utuh) {
    try {
      fs.writeFileSync(tmpFileOut, utuh);
    } catch (error) {
      // Disk penuh bisa meninggalkan berkas setengah jadi.
      hapusSementara(tmpFileOut);
      throw error;
    }
    return tmpFileOut;
  }

  // Cadangan: webp sederhana (tanpa VP8X) — di bentuk ini node-webpmux tidak
  // bermasalah, dan ia yang membuatkan header VP8X-nya.
  const tmpFileIn = path.join(
    tmpdir(),
    `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`,
  );
  try {
    fs.writeFileSync(tmpFileIn, wMedia);

    const img = new webp.Image();
    await img.load(tmpFileIn);
    img.exif = exif;
    await img.save(tmpFileOut);
    return tmpFileOut;
  } catch (error) {
    hapusSementara(tmpFileOut);
    throw error;
  } finally {
    hapusSementara(tmpFileIn);
  }
}

async function writeExifImg(media, metadata) {
  // imageToWebp sudah menangani sumber webp (termasuk yang animasi) tanpa
  // melewatkannya ke ffmpeg — lihat webpKeStiker.
  let wMedia = await imageToWebp(media);
  return simpanDenganExif(wMedia, metadata);
}

async function writeExifVid(media, metadata) {
  let wMedia = await videoToWebp(media);
  return simpanDenganExif(wMedia, metadata);
}

async function writeExif(media, metadata) {
  let wMedia = /webp/.test(media.mimetype)
    ? media.data
    : /image/.test(media.mimetype)
      ? await imageToWebp(media.data)
      : /video/.test(media.mimetype)
        ? await videoToWebp(media.data)
        : '';
  return simpanDenganExif(wMedia, metadata);
}

/**
 * Tandai stiker animasi secara EKSPLISIT.
 *
 * zapo sebenarnya bisa menyimpulkan `isAnimated` sendiri, TAPI ia hanya
 * membaca 100 byte pertama berkas. Pendeteksinya berhenti begitu chunk frame
 * pertama melewati batas buffer itu — dan frame pertama webp animasi nyata
 * hampir selalu ribuan byte. Akibatnya `isAnimated` selalu `false` dan stiker
 * terkirim sebagai gambar diam.
 *
 * node-webpmux (sudah jadi dependency) membaca seluruh berkas, jadi dipakai
 * untuk menentukannya di sini.
 *
 * @returns {Promise<{isAnimated?: boolean}>} objek kosong bila bukan animasi
 */
async function animasiStiker(buffer) {
  try {
    const img = new webp.Image();
    await img.load(buffer);
    return img.hasAnim ? { isAnimated: true } : {};
  } catch {
    // Bukan webp / gagal dibaca -> biarkan zapo yang memutuskan.
    return {};
  }
}

/** Tulis buffer ke berkas sementara .webp dan kembalikan path-nya. */
function tulisSementaraWebp(buffer) {
  const file = path.join(tmpdir(), `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);
  try {
    fs.writeFileSync(file, buffer);
  } catch (error) {
    hapusSementara(file);
    throw error;
  }
  return file;
}

/**
 * Jalur cadangan bila pemrosesan stiker normal gagal (mis. ffmpeg "Invalid
 * data found", sharp gagal dimuat di panel, berkas webp yang bentuknya aneh).
 * Lebih baik stiker terkirim tanpa dirapikan daripada pengguna hanya
 * mendapat pesan error. Dicoba berurutan:
 *
 *  1. webp: kirim apa adanya + EXIF paket (disisipkan di level chunk)
 *  2. gambar lain: konversi langsung pakai sharp (tanpa ffmpeg) + EXIF
 *  3. terakhir: kirim buffer webp mentah tanpa EXIF
 *
 * @returns {Promise<string>} path berkas stiker sementara
 */
async function stikerCadangan(imageBuffer, type, options) {
  const pakaiExif = options.packname || options.author;
  let webpBuffer = type.mime === 'image/webp' ? imageBuffer : null;

  if (!webpBuffer) {
    try {
      const sharp = (await import('sharp')).default;
      webpBuffer = await sharp(imageBuffer, { animated: true })
        .resize(UKURAN_STIKER, UKURAN_STIKER, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 75 })
        .toBuffer();
    } catch (error) {
      console.warn('[STICKER] Cadangan sharp gagal:', error?.message || error);
      throw error; // tidak ada webp yang bisa dikirim
    }
  }

  if (pakaiExif) {
    try {
      const hasil = await simpanDenganExif(webpBuffer, options);
      if (hasil) return hasil;
    } catch (error) {
      console.warn('[STICKER] Cadangan EXIF gagal, dikirim tanpa EXIF:', error?.message || error);
    }
  }
  return tulisSementaraWebp(webpBuffer);
}

async function sendImageAsSticker(sock, remoteJid, imageBuffer, options = {}, message) {
  // Cek tipe file dari imageBuffer
  const type = await FileType.fromBuffer(imageBuffer);

  if (!type) {
    throw new Error('Tidak dapat menentukan tipe file');
  }

  // Cek apakah itu gambar
  if (type.mime.startsWith('image/')) {
    // Mengubah gambar menjadi stiker dan menambahkan metadata jika ada.
    // Bila jalur normal gagal, pakai jalur cadangan supaya stiker tetap
    // terkirim (lihat stikerCadangan).
    let stickerUrl;
    try {
      stickerUrl =
        options.packname || options.author
          ? await writeExifImg(imageBuffer, options)
          : await imageToWebp(imageBuffer);
      if (typeof stickerUrl !== 'string' && !Buffer.isBuffer(stickerUrl)) {
        throw new Error('Hasil konversi stiker kosong');
      }
    } catch (error) {
      // Pesan error ffmpeg memuat seluruh stderr-nya — cukup baris pertama.
      const ringkas = String(error?.message || error).split('\n')[0];
      console.warn('[STICKER] Proses normal gagal, pakai cadangan:', ringkas);
      stickerUrl = await stikerCadangan(imageBuffer, type, options);
    }

    // Mengirimkan stiker menggunakan sock
    try {
      await sock.sendMessage(
        remoteJid,
        {
          sticker: { url: stickerUrl },
          // `isAiSticker` dan `premium` SENGAJA TIDAK dikirim.
          //
          // Keduanya field proto sungguhan yang benar-benar sampai ke WhatsApp
          // (sudah diuji encode/decode). `isAiSticker: true` menandai stiker
          // sebagai hasil AI, dan WhatsApp melarang stiker AI DISIMPAN ke
          // koleksi penerima — itulah sebabnya stiker dari sini tidak bisa
          // disimpan sementara `.wm` bisa.
          ...(await animasiStiker(imageBuffer)),

          ...options,
        },
        { quoted: message },
      );
    } finally {
      // Berkas stiker hanya dibutuhkan selama pengiriman. Dulu tidak pernah
      // dihapus dan menumpuk di /tmp sampai disk panel penuh (ENOSPC).
      hapusSementara(stickerUrl);
    }

    return stickerUrl; // Mengembalikan URL stiker (berkasnya sudah dihapus)
  }
  // Cek apakah itu video
  else if (type.mime.startsWith('video/')) {
    const stickerUrl =
      options.packname || options.author
        ? await writeExifVid(imageBuffer, options)
        : await videoToWebp(imageBuffer);

    // Mengirimkan stiker menggunakan sock
    try {
      await sock.sendMessage(
        remoteJid,
        {
          sticker: { url: stickerUrl },
          // Lihat catatan di jalur gambar: `isAiSticker`/`premium` dibuang
          // supaya stikernya bisa disimpan penerima.
          ...options,
        },
        { quoted: message },
      );
    } finally {
      hapusSementara(stickerUrl); // lihat catatan di jalur gambar
    }

    return stickerUrl; // Mengembalikan URL stiker (berkasnya sudah dihapus)
  }
  // Jenis file lainnya
  else {
    throw new Error(`Tipe file tidak didukung: ${type.mime}`);
  }
}

export {
  gifToWebp,
  imageToWebp,
  webpToImage,
  videoToWebp,
  writeExifImg,
  writeExifVid,
  writeExif,
  sendImageAsSticker,
};
