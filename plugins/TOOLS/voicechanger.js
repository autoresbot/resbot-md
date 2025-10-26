import {
  convertAudioToCompatibleFormat,
  generateUniqueFilename,
  downloadQuotedMedia,
  downloadMedia,
  reply,
} from "../../lib/utils.js";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { exec as exec2 } from "child_process";
import util from "util";

const exec = util.promisify(exec2);

/**
 * Mengubah pitch audio menggunakan ffmpeg
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {number} sampleRate
 * @returns {Promise<Buffer>}
 */
async function changePitch(inputPath, outputPath, sampleRate = 44100) {
  try {
    // Gunakan input ≠ output agar ffmpeg tidak error
    const command = `ffmpeg -i "${inputPath}" -af "asetrate=${sampleRate},aresample=${sampleRate}" "${outputPath}" -y`;
    await exec(command);
    return await fsp.readFile(outputPath);
  } catch (error) {
    console.error("Terjadi kesalahan saat mengubah pitch:", error);
    throw error;
  }
}

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, prefix, command, content, isQuoted } =
    messageInfo;

  try {
    // Validasi media
    const mediaType = isQuoted?.type;
    if (mediaType !== "audio") {
      return await reply(
        m,
        `⚠️ _Balas audio/vn dengan caption *${prefix + command}*_`
      );
    }

    // Validasi karakter
    if (!content) {
      return await reply(
        m,
        `⚠️ _Balas audio/vn dengan caption *${prefix + command}*_\n\n` +
          `_*Masukkan Karakter*_\n> tupai\n> raksasa\n> monster\n> robot\n> bayi\n> kakek\n> alien\n\n` +
          `Contoh: _*${prefix + command} tupai*_`
      );
    }

    // Reaksi loading
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Pastikan folder tmp ada
    const tmpFolder = path.join(process.cwd(), "tmp");
    if (!fs.existsSync(tmpFolder)) fs.mkdirSync(tmpFolder, { recursive: true });

    // Download media
    const media = isQuoted
      ? await downloadQuotedMedia(message)
      : await downloadMedia(message);

    const mediaPath = path.join(tmpFolder, media);

    // Daftar karakter dan pitch
    const karakterPitchPairs = [
      { karakter: "tupai", pitch: 48000 },
      { karakter: "raksasa", pitch: 22050 },
      { karakter: "monster", pitch: 40000 },
      { karakter: "robot", pitch: 32000 },
      { karakter: "bayi", pitch: 16000 },
      { karakter: "kakek", pitch: 20000 },
      { karakter: "alien", pitch: 55000 },
    ];

    const selectedPair = karakterPitchPairs.find(
      (pair) => pair.karakter === content.toLowerCase()
    );

    if (!selectedPair) {
      return await reply(
        m,
        `_*Masukkan Karakter*_\n> tupai\n> raksasa\n> monster\n> robot\n> bayi\n> kakek\n> alien\n\n` +
          `Contoh: _*${prefix + command} tupai*_`
      );
    }

    // File output unik untuk ffmpeg
    const outputPath = path.join(tmpFolder, `voicechanger_${Date.now()}.mp3`);

    // Konversi pitch
    const audioBuffer = await changePitch(
      mediaPath,
      outputPath,
      selectedPair.pitch
    );

    // Simpan ke file unik untuk kompatibilitas WA
    const inputPath = path.join(tmpFolder, `voicechanger2_${Date.now()}.mp3`);
    await fsp.writeFile(inputPath, audioBuffer);

    // Konversi ke format WA kompatibel & kirim
    let bufferToSend = audioBuffer;
    try {
      bufferToSend = await convertAudioToCompatibleFormat(inputPath);
      await sock.sendMessage(
        remoteJid,
        { audio: { url: bufferToSend }, mimetype: "audio/mp4" },
        { quoted: message }
      );
    } catch (err) {
      console.warn("Gagal konversi audio, pakai buffer asli:", err.message);
      await sock.sendMessage(
        remoteJid,
        { audio: bufferToSend, mimetype: "audio/mp4" },
        { quoted: message }
      );
    }

    // Hapus file sementara
    await Promise.all([
      fsp.unlink(inputPath),
      fsp.unlink(outputPath),
      fsp.unlink(mediaPath),
    ]);
  } catch (error) {
    console.error("Kesalahan di fungsi handle:", error);
    await sock.sendMessage(
      remoteJid,
      { text: `_Error: ${error.message}_` },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["voicechanger"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
