import { addList, getDataByGroupId } from "../../lib/list.js";
import { downloadQuotedMedia, downloadMedia } from "../../lib/utils.js";
import { getGroupMetadata } from "../../lib/cache.js";
import { deleteCache } from "../../lib/globalCache.js";
import mess from "../../strings.js";

async function handle(sock, messageInfo) {
  const {
    remoteJid,
    isGroup,
    message,
    content,
    sender,
    isQuoted,
    command,
    prefix,
  } = messageInfo;

  try {
    let idList = remoteJid;

    if (!isGroup) {
      // Chat Pribadi
      idList = "owner";
    } else {
      // Mendapatkan metadata grup
      const groupMetadata = await getGroupMetadata(sock, remoteJid);
      const participants = groupMetadata.participants;

      const isAdmin = participants.some(
        (p) => (p.phoneNumber === sender || p.id === sender) && p.admin
      );

      if (!isAdmin) {
        await sock.sendMessage(
          remoteJid,
          { text: mess.general.isAdmin },
          { quoted: message }
        );
        return;
      }
    }

    // Validasi isi pesan
    if (!content.trim()) {
      return sendMessageWithTemplate(
        sock,
        remoteJid,
        `_⚠️ Format Penggunaan:_\n\n_Contoh :_ *${
          prefix + command
        } payment | Halo @name Untuk Pembayaran Hanya Melalui Dana ...*\n\n_Apabila ingin menambah list dan gambar, silakan kirim/reply gambarnya dengan caption_ *${
          prefix + command
        }*
                
_*List Variable*_

${global.group.variable}`,
        message
      );
    }

    let text = "";
    let keyword = "";

    const parts = content.split("|");
    keyword = parts.shift().trim(); // Keyword tetap di-trim untuk membersihkan spasi ekstra di awal & akhir
    text = parts.join("|"); // Gabungkan sisa elemen tanpa mengubah spasi asli

    // Memeriksa apakah isQuoted didefinisikan
    if (isQuoted) {
      switch (isQuoted.type) {
        case "text":
          text ||= isQuoted.text || "-";
          break;
        case "image":
          text ||= isQuoted.content?.caption || "-";
          break;
        case "sticker":
          text = "sticker";
          break;
        case "video":
          text ||= isQuoted.content?.caption || "-";
          break;
        case "audio":
          text ||= "-";
          break;
        case "document":
          text ||= "-";
          break;
      }
    }

    // Pastikan keyword memiliki nilai untuk menghindari error saat trim()
    const lowercaseKeyword = (keyword || "").trim().toLowerCase();

    if (!keyword || !text) {
      return sendMessageWithTemplate(
        sock,
        remoteJid,
        `⚠️ _Format tidak valid!_\n\nContoh : ${
          prefix + command
        } payment | Pembayaran Hanya Melalui Dana ...\n\n_Apabila ingin menambah list dan gambar, silakan kirim/reply gambarnya dengan caption_ *${
          prefix + command
        }*`,
        message
      );
    }

    // Cek apakah keyword sudah ada
    const currentList = await getDataByGroupId(idList);

    if (currentList?.list?.[lowercaseKeyword]) {
      return sendMessageWithTemplate(
        sock,
        remoteJid,
        `⚠️ _Keyword *${lowercaseKeyword}* sudah ada sebelumnya!_\n\n_Silakan gunakan keyword lain atau updatelist._`,
        message
      );
    }

    // reset cache
    deleteCache(`list-${idList}`);

    // Tangani media jika ada
    const mediaUrl = await handleMedia(messageInfo);

    // Tambahkan ke database
    const result = await addList(idList, lowercaseKeyword, {
      text,
      media: mediaUrl,
    });
    if (result.success) {
      return sendMessageWithTemplate(
        sock,
        remoteJid,
        `${lowercaseKeyword} _sudah ditambahkan ke daftar list_\n\n_Ketik *list* untuk melihat daftar list._`,
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
  Commands: ["addlist"],
  OnlyPremium: false,
  OnlyOwner: false,
};
