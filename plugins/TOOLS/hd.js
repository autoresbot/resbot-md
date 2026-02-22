import { downloadQuotedMedia, downloadMedia, reply } from "../../lib/utils.js";
import fs from "fs";
import path from "path";
import mess from "../../strings.js";
import axios from "axios";
import ApiAutoresbotModule from "api-autoresbot";
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;
import config from "../../config.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, prefix, command, type, isQuoted } =
    messageInfo;

  try {
    const mediaType = isQuoted ? isQuoted.type : type;
    if (mediaType !== "image") {
      return await reply(
        m,
        `⚠️ _Kirim/Balas gambar dengan caption *${prefix + command}*_`
      );
    }

    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    const media = isQuoted
      ? await downloadQuotedMedia(message)
      : await downloadMedia(message);

    const mediaPath = path.join("tmp", media);

    if (!fs.existsSync(mediaPath)) {
      throw new Error("File media tidak ditemukan.");
    }

    // Upload ke tmp
    const api = new ApiAutoresbot(config.APIKEY);
    const upload = await api.tmpUpload(mediaPath);

    if (!upload || upload.code !== 200) {
      throw new Error("Upload gagal.");
    }

    const imageUrl = upload.data.url;

    // ===============================
    // 🔥 STEP 1: CREATE JOB
    // ===============================

    const createRes = await axios.get(
      `https://api.autoresbot.com/api/tools/remini`,
      {
        params: { url: imageUrl },
        headers: {
          Authorization: `Bearer ${config.APIKEY}`,
        },
      }
    );

    if (!createRes.data?.job_id) {
      throw new Error("Gagal membuat job.");
    }

    const jobId = createRes.data.job_id;

    // ===============================
    // 🔥 STEP 2: POLLING
    // ===============================

    const maxRetry = 10;
    const delayMs = 7000;
    let attempt = 0;
    let finalImageUrl = null;

    while (attempt < maxRetry) {
      attempt++;
      //console.log(`Polling attempt ${attempt}`);

      const pollRes = await axios.get(
        `https://api.autoresbot.com/api/tools/remini`,
        {
          params: { job_id: jobId },
          headers: {
            Authorization: `Bearer ${config.APIKEY}`,
          },
          validateStatus: () => true,
        }
      );

      const data = pollRes.data;

      if (data.status === "done") {
        finalImageUrl = data.result;
        console.log("Job selesai ✅", finalImageUrl);
        break;
      }

      if (data.status === "failed") {
        throw new Error(data.error || "Remini gagal.");
      }

      //console.log("Masih processing...");
      await delay(delayMs);
    }

    if (!finalImageUrl) {
      throw new Error("Gagal mendapatkan hasil setelah polling.");
    }

    // ===============================
    // 🔥 STEP 3: DOWNLOAD FINAL IMAGE
    // ===============================

    const imageRes = await axios.get(finalImageUrl, {
      responseType: "arraybuffer",
    });

    const MediaBuffer = Buffer.from(imageRes.data);

    await sock.sendMessage(
      remoteJid,
      {
        image: MediaBuffer,
        caption: mess.general.success,
      },
      { quoted: message }
    );

  } catch (error) {
    await reply(
      m,
      `_Terjadi kesalahan saat memproses gambar._\n\nERROR: ${error.message}`
    );
  }
}

export default {
  handle,
  Commands: ["hd", "remini"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};