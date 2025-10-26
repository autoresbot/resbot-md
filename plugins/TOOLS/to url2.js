import { downloadQuotedMedia, downloadMedia, reply } from "../../lib/utils.js";
import path from "path";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";

async function uploadToCatbox(filePath) {
  try {
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("fileToUpload", fs.createReadStream(filePath));

    const response = await axios.post("https://catbox.moe/user/api.php", form, {
      headers: {
        ...form.getHeaders(),
      },
    });
    return response.data;
  } catch (error) {
    console.error(
      "Upload failed:",
      error.response ? error.response.data : error.message
    );
    throw new Error("Upload ke Catbox gagal.");
  }
}

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, isQuoted, type, prefix, command } =
    messageInfo;
  try {
    const mediaType = isQuoted ? isQuoted.type : type;
    if (
      !["image", "sticker", "video", "audio", "document"].includes(mediaType)
    ) {
      return await reply(
        m,
        `⚠️ _Kirim/Balas document dengan caption *${prefix + command}*_`
      );
    }

    await sock.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    const media = isQuoted
      ? await downloadQuotedMedia(message)
      : await downloadMedia(message);
    const mediaPath = path.join("tmp", media);

    if (!fs.existsSync(mediaPath)) {
      throw new Error("File media tidak ditemukan setelah diunduh.");
    }

    const result = await uploadToCatbox(mediaPath);

    await reply(
      m,
      `_✅ Upload sukses!_
📎 *Link*: ${result}`
    );

    fs.unlinkSync(mediaPath); // Hapus file setelah diunggah
  } catch (error) {
    console.error("Error in handle function:", error);
    await sock.sendMessage(
      remoteJid,
      { text: "⚠️ Maaf, terjadi kesalahan saat mengunggah. Coba lagi nanti!" },
      { quoted: message }
    );
  }
}
export default {
  handle,
  Commands: ["tourl2"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
