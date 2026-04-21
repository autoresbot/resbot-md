import { addList, getDataByGroupId } from "../../lib/list.js";
import { downloadQuotedMedia, downloadMedia } from "../../lib/utils.js";
import { deleteCache } from "../../lib/globalCache.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, sender, command, prefix } = messageInfo;

  try {
    // Validasi isi pesan
    if (!content.trim()) {
      return sendMessageWithTemplate(
        sock,
        remoteJid,
        `_Masukkan Perintah dan Pesannya_\n\nContoh : ${
          prefix + command
        } donasi | Berikut link donasi...\n\n_Apabila ingin menambah respon dengan gambar, silakan kirim/reply gambarnya dengan caption_ *${
          prefix + command
        }*`,
        message
      );
    }

    // Pisahkan keyword dan teks
    const [keyword, text] = content.split("|").map((item) => item.trim());
    const lowercaseKeyword = keyword.trim().toLowerCase();

    if (!keyword || !text) {
      return sendMessageWithTemplate(
        sock,
        remoteJid,
        `⚠️ _Format tidak valid!_\n\nContoh : *${
          prefix + command
        } donasi | Berikut link donasi...*\n\n_Apabila ingin menambah respon dengan gambar, silakan kirim/reply gambarnya dengan caption_ *${
          prefix + command
        }*`,
        message
      );
    }

    // Cek apakah keyword sudah ada
    const currentList = await getDataByGroupId(remoteJid);

    if (currentList?.list?.[lowercaseKeyword]) {
      return sendMessageWithTemplate(
        sock,
        remoteJid,
        `_⚠️ Keyword *${lowercaseKeyword}* sudah ada sebelumnya!_\n_Silakan gunakan keyword lain atau *.updaterespon*_`,
        message
      );
    }

    // Tangani media jika ada
    const mediaUrl = await handleMedia(messageInfo);

    // Tambahkan ke database
    const result = await addList("owner", lowercaseKeyword, {
      text,
      media: mediaUrl,
    });
    if (result.success) {
      deleteCache(`list-owner`); // reset cache
      return sendMessageWithTemplate(
        sock,
        remoteJid,
        `${lowercaseKeyword} _sudah ditambahkan ke daftar respon_\n\n_Ketik *listrespon* untuk melihat daftar respon._`,
        message
      );
    }

    return sendMessageWithTemplate(
      sock,
      remoteJid,
      `❌ ${result.message}`,
      message
    );
  } catch (error) {
    console.error("Error processing command:", error);
    return sendMessageWithTemplate(
      sock,
      remoteJid,
      "_❌ Maaf, terjadi kesalahan saat memproses data._",
      message
    );
  }
}

// Fungsi untuk mengirim pesan dengan template
function sendMessageWithTemplate(sock, remoteJid, text, quoted) {
  return sock.sendMessage(remoteJid, { text }, { quoted });
}

// Fungsi untuk menangani unduhan media
async function handleMedia({ isQuoted, type, message }) {
  const supportedMediaTypes = [
    "image",
    "audio",
    "sticker",
    "video",
    "document",
  ];

  if (isQuoted && supportedMediaTypes.includes(isQuoted.type)) {
    return await downloadQuotedMedia(message, true);
  } else if (supportedMediaTypes.includes(type)) {
    return await downloadMedia(message, true);
  }
  return null;
}

export default {
  handle,
  Commands: ["addrespon"],
  OnlyPremium: false,
  OnlyOwner: true,
};
