import { proto } from "zapo-js";
import { getDataByGroupId } from "../../lib/list.js";
import { applyTemplate } from "../../database/templates/list.js";
import { getGroupMetadata } from "../../lib/cache.js";
import { checkMessage } from "../../lib/participants.js";
import fs from "fs/promises";

import {
  sendMessageWithMention,
  getCurrentTime,
  getCurrentDate,
  getGreeting,
  getHari,
} from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { remoteJid, isGroup, sender, message, content, senderType, prefix } =
    messageInfo;

  let idList = remoteJid;

  if (!isGroup) {
    // Chat Pribadi
    idList = "owner";
  } else {
  }

  const first_checksetlist = await checkMessage(remoteJid, "setlist");

  let defaultLIst = 1;
  const result = await checkMessage(remoteJid, "templatelist");

  if (result) {
    defaultLIst = result;
  }

  let nameGrub = "";
  let size = "";
  let desc = "";

  if (isGroup) {
    // Mendapatkan metadata grup
    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    nameGrub = groupMetadata.subject || "";
    size = groupMetadata.size || "";
    desc = groupMetadata.desc || "";
  }

  try {
    // Ambil data list berdasarkan grup
    const currentList = await getDataByGroupId(idList);

    // Jika tidak ada list
    if (!currentList || !currentList.list) {
      await sock.sendMessage(remoteJid, {
        text: "_Tidak Ada List Di Grup Ini, silakan ketik *addlist* untuk membuat baru_\n\n_Hanya *admin* yang dapat menambah / menghapus list_",
      });
      return;
    }

    if (Object.keys(currentList.list).length === 0) {
      await sock.sendMessage(remoteJid, {
        text: "_Tidak Ada List Di Grup Ini, silakan ketik *addlist* untuk membuat baru_\n\n_Hanya *admin* yang dapat menambah / menghapus list_",
      });
      return;
    }

    // Nomor list mengikuti urutan yang DITAMPILKAN, yaitu urut abjad: semua
    // template mengurutkannya (sortList), begitu juga mode setlist.
    //
    // Dulu nomornya memakai urutan penyimpanan, padahal yang tampil terurut
    // abjad — jadi pada template bernomor, ".list 3" membuka list yang berbeda
    // dari nomor 3 yang terbaca di layar.
    const keywordList = Object.keys(currentList.list).sort();

    const keywordList2 = keywordList;

    const firstElement =
      content > 0 && content <= keywordList.length
        ? keywordList[content - 1]
        : false;

    if (!firstElement) {
      // Data dinamis yang kita masukkan
      const data = {
        name: `@${sender.split("@")[0]}`,
        date: getCurrentDate(),
        day: getHari(),
        desc: desc,
        group: nameGrub,
        greeting: getGreeting(),
        size: size,
        time: `${getCurrentTime()} WIB`,
        // Salinan: template boleh mengurutkan/mengubahnya sesuka hati tanpa
        // menggeser urutan keywordList, yang jadi dasar nomor ".list <nomor>".
        list: [...keywordList],
      };

      if (first_checksetlist) {
        // jika ada setingan set list

        let lines = first_checksetlist.split("\n"); // Pecah teks menjadi array per baris
        let formattedList = []; // Array untuk menyimpan teks hasil

        for (let line of lines) {
          if (line.includes("@x")) {
            let template = line.replace("@x", "").trim(); // Ambil simbol sebelum @x
            let listItems = keywordList2
              .map((item) => `${template} ${item}`)
              .join("\n"); // Buat daftar
            formattedList.push(listItems); // Masukkan daftar yang sudah diformat
          } else {
            formattedList.push(line); // Jika bukan @x, tambahkan langsung
          }
        }

        let message2 = formattedList.join("\n"); // Gabungkan kembali jadi teks utuh

        message2 = message2
          .replace(/@name/g, data.name)
          .replace(/@date/g, data.date)
          .replace(/@day/g, data.day)
          .replace(/@desc/g, data.desc)
          .replace(/@group/g, data.group)
          .replace(/@greeting/g, data.greeting)
          .replace(/@size/g, data.size)
          .replace(/@time/g, data.time);

        const hasil = await sendMessageWithMention(
          sock,
          remoteJid,
          message2,
          message,
          senderType
        );
        await sendPilihList(sock, remoteJid, keywordList, prefix);
        return hasil;
      }

      const finalMessage = applyTemplate(defaultLIst, data);
      const hasil = await sendMessageWithMention(
        sock,
        remoteJid,
        finalMessage,
        message,
        senderType
      );
      await sendPilihList(sock, remoteJid, keywordList, prefix);
      return hasil;
    }

    // firstElement SUDAH nama list yang tepat (diambil dari keywordList lewat
    // nomornya), jadi isinya diambil langsung.
    //
    // Dulu namanya dicari ULANG di sini dengan pencocokan sebagian
    // (`includes`) lalu diambil hasil PERTAMA. Akibatnya list yang namanya
    // terkandung di dalam nama list lain selalu membuka isi yang salah:
    // dengan list "robot" dan "bot", memilih "bot" menampilkan isi "robot".
    const dataList = currentList.list[firstElement];

    if (!dataList?.content) {
      return await sock.sendMessage(remoteJid, {
        text: "_Tidak Ada List ditemukan_",
      });
    }

    const { text, media } = dataList.content;

    if (media) {
      const buffer = await getMediaBuffer(media);
      if (buffer) {
        await sendMediaMessage(sock, remoteJid, buffer, text, message);
      } else {
        console.error(`Media not found or failed to read: ${media}`);
      }
    } else {
      // Kirim pesan dengan mention
      await sendMessageWithMention(sock, remoteJid, text, message, senderType);
    }
  } catch (error) {
    console.error(error);
  }
}

/**
 * Menu "Pilih List" yang dikirim setelah daftar list, supaya anggota cukup
 * mengetuk nama list tanpa mengetik apa pun.
 *
 * Dikirim sebagai proto mentah (panduan raw sends zapo). Ada DUA bentuk menu
 * pilihan di WhatsApp, dan bentuk yang dipakai di sini sengaja dibalik dari
 * urutan contoh di dokumentasi:
 *
 *   1. `interactiveMessage` + `nativeFlowMessage` (single_select) — DIPAKAI.
 *      zapo mengirimnya dengan node <native_flow name="mixed" v="9">, bentuk
 *      yang masih diterima server sekarang.
 *   2. `listMessage` — CADANGAN. Ini contoh di dokumentasi zapo, tapi node
 *      yang dibangunnya <list type="product_list" v="2"> sudah bentuk lama:
 *      server menolaknya untuk akun biasa dengan
 *      "negative publish ack: class=message error=479" (SMAX_INVALID).
 *      Tetap dicoba kalau bentuk pertama gagal, karena sebagian akun bisnis
 *      masih menampilkannya.
 *
 * Tiap baris membawa command ".list <nomor>"; balasan pilihannya dibaca
 * lib/serializeMessage.js dan diproses seperti pesan yang diketik biasa.
 *
 * Daftar list versi teks SUDAH terkirim sebelum fungsi ini dipanggil, jadi
 * kalau kedua bentuk ditolak bot tetap berguna — kegagalan cukup dicatat.
 */
// Batas WhatsApp: 10 baris per bagian, dan maksimal 10 bagian per pesan.
const BARIS_PER_BAGIAN = 10;
const MAKS_BAGIAN = 10;

async function sendPilihList(sock, remoteJid, keywordList, prefix) {
  try {
    const awalan = prefix || ".";

    // keywordList sudah dalam urutan yang ditampilkan, dan nomornya sama
    // dengan yang dipakai ".list <nomor>". Jangan diurutkan ulang di sini:
    // urutannya harus tetap sama persis dengan daftar teks di atas.
    const rows = keywordList
      .slice(0, BARIS_PER_BAGIAN * MAKS_BAGIAN)
      .map((keyword, index) => ({
        // WhatsApp memotong judul baris yang terlalu panjang.
        title: keyword.length > 24 ? `${keyword.slice(0, 21)}...` : keyword,
        description: `Lihat isi list ${keyword}`,
        rowId: `${awalan}list ${index + 1}`,
      }));

    if (!rows.length) return;

    const sections = [];
    for (let i = 0; i < rows.length; i += BARIS_PER_BAGIAN) {
      const akhir = Math.min(i + BARIS_PER_BAGIAN, rows.length);
      sections.push({
        title: rows.length > BARIS_PER_BAGIAN ? `List ${i + 1} - ${akhir}` : "Daftar List",
        rows: rows.slice(i, akhir),
      });
    }

    const keterangan =
      keywordList.length > rows.length
        ? `Menampilkan ${rows.length} dari ${keywordList.length} list. Sisanya ketik ${awalan}list <nomor>`
        : "Ketuk tombol di bawah untuk memilih list";

    // Bentuk 1: native flow (lihat catatan di atas)
    try {
      await sock.sendMessage(remoteJid, {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              body: { text: keterangan },
              footer: { text: `Resbot ${global.version}` },
              nativeFlowMessage: {
                buttons: [
                  {
                    name: "single_select",
                    buttonParamsJson: JSON.stringify({
                      title: "Pilih List",
                      sections: sections.map((bagian) => ({
                        title: bagian.title,
                        // native flow memakai `id`, bukan `rowId`
                        rows: bagian.rows.map((baris) => ({
                          header: "",
                          title: baris.title,
                          description: baris.description,
                          id: baris.rowId,
                        })),
                      })),
                    }),
                  },
                ],
              },
            },
          },
        },
      });
      return;
    } catch (error) {
      console.warn(
        "[LIST] Menu native flow ditolak, mencoba bentuk list lama:",
        error?.message || error,
      );
    }

    // Bentuk 2: listMessage (cadangan)
    await sock.sendMessage(remoteJid, {
      listMessage: {
        title: "Daftar List",
        description: keterangan,
        buttonText: "Pilih List",
        footerText: `Resbot ${global.version}`,
        listType: proto.Message.ListMessage.ListType.SINGLE_SELECT,
        sections,
      },
    });
  } catch (error) {
    console.warn("[LIST] Menu Pilih List gagal dikirim:", error?.message || error);
  }
}

async function getMediaBuffer(mediaFileName) {
  const filePath = `./database/media/${mediaFileName}`;
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    console.error(`Failed to read media file: ${filePath}`, error);
    return null;
  }
}

async function sendMediaMessage(sock, remoteJid, buffer, caption, quoted) {
  try {
    await sock.sendMessage(remoteJid, { image: buffer, caption }, { quoted });
  } catch (error) {
    console.error("Failed to send media message:", error);
  }
}

export default {
  handle,
  Commands: ["list"],
  OnlyPremium: false,
  OnlyOwner: false,
};
