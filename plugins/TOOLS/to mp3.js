import { downloadQuotedMedia, downloadMedia, reply } from "../../lib/utils.js";

import fs from "fs-extra";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { v4 as uuidv4 } from "uuid"; // Untuk menghasilkan UUID yang unik

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, isQuoted, type, content, prefix, command } =
    messageInfo;
  try {
    const mediaType = isQuoted ? isQuoted.type : type;
    if (mediaType !== "video") {
      return await reply(
        m,
        `⚠️ _Kirim/Balas video dengan caption *${prefix + command}*_`
      );
    }

    // Tampilkan reaksi "Loading"
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Download & Upload media
    const media = isQuoted
      ? await downloadQuotedMedia(message)
      : await downloadMedia(message);

    const mediaPath = path.join("tmp", media);
    if (!fs.existsSync(mediaPath)) {
      throw new Error("File media tidak ditemukan setelah diunduh.");
    }

    // Menggunakan UUID untuk membuat nama file unik
    const inputPath = path.join(__dirname, `${uuidv4()}.mp4`);
    const outputPath = path.join(__dirname, `${uuidv4()}.mp3`);

    // Membaca file menjadi Buffer dan menyimpannya dengan nama unik
    const mediaBuffer = fs.readFileSync(mediaPath);
    await fs.writeFile(inputPath, mediaBuffer);

    // Konversi video ke MP3
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat("mp3")
        .on("end", resolve)
        .on("error", reject)
        .save(outputPath);
    });

    // Baca file output menjadi buffer
    const outputBuffer = await fs.readFile(outputPath);

    // Kirim file MP3 yang sudah dikonversi
    await sock.sendMessage(
      remoteJid,
      { audio: { url: outputPath }, mimetype: "audio/mp4" },
      { quoted: message }
    );

    // Hapus file sementara
    await fs.unlink(inputPath);
    await fs.unlink(outputPath);
  } catch (error) {
    console.error("Error in handler:", error);
    await sock.sendMessage(
      remoteJid,
      { text: "Maaf, terjadi kesalahan. Coba lagi nanti!" },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["tomp3"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1, // Jumlah limit yang akan dikurangi
};
