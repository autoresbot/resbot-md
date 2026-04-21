const ApiAutoresbot = await import("api-autoresbot").then(
  (mod) => mod.default || mod
);

import config from "../config.js";
import { danger, downloadQuotedMedia, downloadMedia, reply } from "./utils.js";
import fs from "fs";
import path from "path";

// Objek untuk menyimpan status proses
const processingChats = {};

async function autoAi(sock, messageInfo, content_old) {
  const {
    m,
    remoteJid,
    id,
    command,
    isQuoted,
    content,
    message,
    sender,
    pushName,
    type,
    fullText,
  } = messageInfo;

  // Cek apakah chat ini sedang diproses
  if (processingChats[remoteJid]) {
    return; // Tidak melayani chat lainnya sampai yang sebelumnya selesai
  }

  // Tandai chat ini sebagai sedang diproses
  processingChats[remoteJid] = true;

  try {
    // Cek apakah command 'ai' dengan panjang teks kurang dari 4 karakter
    if (command === "ai" && fullText.length < 4) {
      return await reply(m, "_Halo, ada yang bisa dibantu?_");
    }

    let content_ai = "";
    if (content_old) {
      content_ai += `Konteks: ${content_old}\n`; // Gabungkan dengan content_old
    }
    content_ai += `Pertanyaan: ${fullText}`; // Gabungkan dengan fullText

    const api = new ApiAutoresbot(config.APIKEY);

    // Deteksi media gambar
    const mediaType = isQuoted ? isQuoted.type : type;
    if (mediaType === "image") {
      const media = isQuoted
        ? await downloadQuotedMedia(message)
        : await downloadMedia(message);
      const mediaPath = path.join("tmp", media);

      if (!fs.existsSync(mediaPath)) {
        throw new Error("File media tidak ditemukan setelah diunduh.");
      }

      const response = await api.tmpUpload(mediaPath);

      if (!response || response.code !== 200) {
        throw new Error("File upload gagal atau tidak ada URL.");
      }
      const url = response.data.url;
      const response2 = await api.get("/api/tools/imagerecognition", { url });
      if (!response2 || response2.code !== 200) {
        throw new Error("Gagal mendeteksi gambar.");
      }

      return await reply(m, response2.data);
    }

    // Lakukan panggilan API untuk teks
    const response = await api.get("/api/gemini", { text: content_ai });

    if (response?.data) {
      await reply(m, response.data);
    } else {
      throw new Error("Gagal mendapatkan respons dari API.");
    }
  } catch (error) {
    // Menangani kesalahan dan log dengan baik
    danger(command, `Kesalahan di lib/autoai.js: ${error.message}`);
    await reply(m, `_Terjadi kesalahan: ${error.message}_`);
  } finally {
    // Hapus status proses setelah selesai
    delete processingChats[remoteJid];
  }
}

export default autoAi;
