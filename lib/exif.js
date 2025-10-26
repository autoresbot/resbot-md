import fs from "fs";
import os from "os";
const { tmpdir } = os;
import crypto from "crypto";
import ff from "fluent-ffmpeg";
import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";
import webp from "node-webpmux";
import path from "path";
import FileType from "file-type";

ff.setFfmpegPath(ffmpegPath);

async function gifToWebp(media) {
  const tmpFileOut = path.join(
    os.tmpdir(),
    `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`
  );
  const tmpFileIn = path.join(
    os.tmpdir(),
    `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.gif`
  );

  try {
    // Menulis buffer GIF ke file sementara
    fs.writeFileSync(tmpFileIn, media);

    // Menjalankan konversi GIF ke WebP menggunakan FFmpeg
    await new Promise((resolve, reject) => {
      ff(tmpFileIn)
        .on("error", reject)
        .on("end", () => resolve(true))
        .outputOptions([
          "-vcodec",
          "libwebp",
          "-vf",
          "fps=15,scale=320:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
        ])
        .toFormat("webp")
        .save(tmpFileOut);
    });

    // Membaca file WebP yang dihasilkan menjadi buffer
    const buff = fs.readFileSync(tmpFileOut);

    // Menghapus file sementara
    fs.unlinkSync(tmpFileOut);
    fs.unlinkSync(tmpFileIn);

    return buff;
  } catch (error) {
    // Menangani kesalahan di sini
    console.error("Terjadi kesalahan:", error);
    throw error;
  }
}

async function webpToImage(webpData) {
  const tmpFileOut = path.join(
    tmpdir(),
    `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.jpg`
  );
  const tmpFileIn = path.join(
    tmpdir(),
    `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`
  );

  fs.writeFileSync(tmpFileIn, webpData);

  await new Promise((resolve, reject) => {
    ff(tmpFileIn)
      .on("error", reject)
      .on("end", () => resolve(true))
      .addOutputOptions([
        "-vcodec",
        "mjpeg", // Menggunakan codec MJPEG untuk JPG
        "-q:v",
        "2", // Kualitas gambar (0-2), semakin kecil semakin tinggi kualitasnya
        "-vf",
        "fps=15", // Frame rate (opsional, sesuaikan dengan kebutuhan Anda)
      ])
      .toFormat("image2")
      .save(tmpFileOut);
  });

  const buff = fs.readFileSync(tmpFileOut);
  fs.unlinkSync(tmpFileOut);
  fs.unlinkSync(tmpFileIn);
  return buff;
}

async function imageToWebp(media) {
  const tmpFileOut = path.join(
    tmpdir(),
    `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`
  );
  const tmpFileIn = path.join(
    tmpdir(),
    `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.jpg`
  );

  fs.writeFileSync(tmpFileIn, media);

  await new Promise((resolve, reject) => {
    ff(tmpFileIn)
      .on("error", reject)
      .on("end", () => resolve(true))
      .addOutputOptions([
        "-vcodec",
        "libwebp",
        "-vf",
        "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse",
      ])
      .toFormat("webp")
      .save(tmpFileOut);
  });

  const buff = fs.readFileSync(tmpFileOut);
  fs.unlinkSync(tmpFileOut);
  fs.unlinkSync(tmpFileIn);
  return buff;
}

async function videoToWebp(media) {
  const tmpFileOut = path.join(
    tmpdir(),
    `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`
  );
  const tmpFileIn = path.join(
    tmpdir(),
    `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.mp4`
  );

  fs.writeFileSync(tmpFileIn, media);

  await new Promise((resolve, reject) => {
    ff(tmpFileIn)
      .on("error", reject)
      .on("end", () => resolve(true))
      .addOutputOptions([
        "-vcodec",
        "libwebp",
        "-vf",
        "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse",
        "-loop",
        "0",
        "-ss",
        "00:00:00",
        "-t",
        "00:00:05",
        "-preset",
        "default",
        "-an",
        "-vsync",
        "0",
      ])
      .toFormat("webp")
      .save(tmpFileOut);
  });

  const buff = fs.readFileSync(tmpFileOut);
  fs.unlinkSync(tmpFileOut);
  fs.unlinkSync(tmpFileIn);
  return buff;
}

async function writeExifImg(media, metadata) {
  let wMedia = await imageToWebp(media);
  const tmpFileIn = path.join(
    tmpdir(),
    `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`
  );
  const tmpFileOut = path.join(
    tmpdir(),
    `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`
  );
  fs.writeFileSync(tmpFileIn, wMedia);

  if (metadata.packname || metadata.author) {
    const img = new webp.Image();
    const json = {
      "sticker-pack-id": `https://github.com/DikaArdnt/Hisoka-Morou`,
      "sticker-pack-name": metadata.packname,
      "sticker-pack-publisher": metadata.author,
      emojis: metadata.categories ? metadata.categories : [""],
    };
    const exifAttr = Buffer.from([
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
      0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
    ]);
    const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
    const exif = Buffer.concat([exifAttr, jsonBuff]);
    exif.writeUIntLE(jsonBuff.length, 14, 4);
    await img.load(tmpFileIn);
    fs.unlinkSync(tmpFileIn);
    img.exif = exif;
    await img.save(tmpFileOut);
    return tmpFileOut;
  }
}

async function writeExifVid(media, metadata) {
  let wMedia = await videoToWebp(media);
  const tmpFileIn = path.join(
    tmpdir(),
    `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`
  );
  const tmpFileOut = path.join(
    tmpdir(),
    `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`
  );
  fs.writeFileSync(tmpFileIn, wMedia);

  if (metadata.packname || metadata.author) {
    const img = new webp.Image();
    const json = {
      "sticker-pack-id": `https://github.com/DikaArdnt/Hisoka-Morou`,
      "sticker-pack-name": metadata.packname,
      "sticker-pack-publisher": metadata.author,
      emojis: metadata.categories ? metadata.categories : [""],
    };
    const exifAttr = Buffer.from([
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
      0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
    ]);
    const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
    const exif = Buffer.concat([exifAttr, jsonBuff]);
    exif.writeUIntLE(jsonBuff.length, 14, 4);
    await img.load(tmpFileIn);
    fs.unlinkSync(tmpFileIn);
    img.exif = exif;
    await img.save(tmpFileOut);
    return tmpFileOut;
  }
}

async function writeExif(media, metadata) {
  let wMedia = /webp/.test(media.mimetype)
    ? media.data
    : /image/.test(media.mimetype)
    ? await imageToWebp(media.data)
    : /video/.test(media.mimetype)
    ? await videoToWebp(media.data)
    : "";
  const tmpFileIn = path.join(
    tmpdir(),
    `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`
  );
  const tmpFileOut = path.join(
    tmpdir(),
    `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`
  );
  fs.writeFileSync(tmpFileIn, wMedia);

  if (metadata.packname || metadata.author) {
    const img = new webp.Image();
    const json = {
      "sticker-pack-id": `https://github.com/DikaArdnt/Hisoka-Morou`,
      "sticker-pack-name": metadata.packname,
      "sticker-pack-publisher": metadata.author,
      emojis: metadata.categories ? metadata.categories : [""],
    };
    const exifAttr = Buffer.from([
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
      0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
    ]);
    const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
    const exif = Buffer.concat([exifAttr, jsonBuff]);
    exif.writeUIntLE(jsonBuff.length, 14, 4);
    await img.load(tmpFileIn);
    fs.unlinkSync(tmpFileIn);
    img.exif = exif;
    await img.save(tmpFileOut);
    return tmpFileOut;
  }
}

async function sendImageAsSticker(
  sock,
  remoteJid,
  imageBuffer,
  options = {},
  message
) {
  // Cek tipe file dari imageBuffer
  const type = await FileType.fromBuffer(imageBuffer);

  if (!type) {
    throw new Error("Tidak dapat menentukan tipe file");
  }

  // Cek apakah itu gambar
  if (type.mime.startsWith("image/")) {
    // Mengubah gambar menjadi stiker dan menambahkan metadata jika ada
    const stickerUrl =
      options.packname || options.author
        ? await writeExifImg(imageBuffer, options)
        : await imageToWebp(imageBuffer);

    // Mengirimkan stiker menggunakan sock
    await sock.sendMessage(
      remoteJid,
      {
        sticker: { url: stickerUrl },
        ...options,
      },
      { quoted: message }
    );

    return stickerUrl; // Mengembalikan URL stiker
  }
  // Cek apakah itu video
  else if (type.mime.startsWith("video/")) {
    const stickerUrl =
      options.packname || options.author
        ? await writeExifVid(imageBuffer, options)
        : await videoToWebp(imageBuffer);

    // Mengirimkan stiker menggunakan sock
    await sock.sendMessage(
      remoteJid,
      {
        sticker: { url: stickerUrl },
        ...options,
      },
      { quoted: message }
    );

    return stickerUrl; // Mengembalikan URL stiker
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
