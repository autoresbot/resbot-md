import { downloadQuotedMedia, downloadMedia, convertAudioToOpus, reply } from "../../lib/utils.js";
import fs from "fs-extra";
import path from "path";
import { v4 as uuidv4 } from "uuid";


async function handle(sock, messageInfo) {
  const { m, remoteJid, message, isQuoted, type, content, prefix, command } =
    messageInfo;
  try {
    const mediaType = isQuoted ? isQuoted.type : type;
    if (mediaType !== "audio" && mediaType !== "video") {
      return await reply(
        m,
        `⚠️ _Kirim/Balas Audio dengan caption *${prefix + command}*_`
      );
    }

    // Tampilkan reaksi "Loading"
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Download media
    const media = isQuoted
      ? await downloadQuotedMedia(message)
      : await downloadMedia(message);

    // Folder sementara di root project
    const tmpFolder = path.join(process.cwd(), "tmp");
    if (!fs.existsSync(tmpFolder)) fs.mkdirSync(tmpFolder, { recursive: true });

    const mediaPath = path.join(tmpFolder, media);
    if (!fs.existsSync(mediaPath)) {
      throw new Error("File media tidak ditemukan setelah diunduh.");
    }
  
    // Nama file unik
    const inputPath = path.join(tmpFolder, `${uuidv4()}.mp4`);
    const outputPath = path.join(tmpFolder, `${uuidv4()}.opus`);

    // Simpan buffer media ke inputPath
    const mediaBuffer = fs.readFileSync(mediaPath);
    await fs.writeFile(inputPath, mediaBuffer);



    try {
      const convertedPath = await convertAudioToOpus(inputPath);
      const bufferFinal = await fs.readFile(`${convertedPath}`);

          await sock.sendMessage(
            remoteJid,
            {
              audio: bufferFinal,
              mimetype: "audio/mp4",
              ptt: true,
            },
            { quoted: message }
          );
      return;
    } catch (err) {
      console.log("Konversi ke Opus gagal, melanjutkan dengan file asli.");
    }

    // Kirim audio
    await sock.sendMessage(
      remoteJid,
      {
        audio: { url: outputPath },
        mimetype: "audio/mp4",
      },
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
  Commands: ["tovn"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
