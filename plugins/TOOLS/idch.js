import { reply, getContextInfo } from "../../lib/utils.js";
import { logCustom } from "../../lib/logger.js";

// Link saluran: https://whatsapp.com/channel/<kode> (boleh www. / tanpa https)
const POLA_LINK = /(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/channel\/([\w-]+)/i;
const POLA_JID = /(\d+@newsletter)/i;

const TEKS_STATUS = {
  ACTIVE: "Aktif",
  SUSPENDED: "Ditangguhkan",
  GEOSUSPENDED: "Diblokir di wilayah ini",
  DELETED: "Dihapus",
  NON_EXISTING: "Tidak ada",
};

/**
 * Cari `forwardedNewsletterMessageInfo` di dalam objek pesan. Pesan terusan
 * dari saluran membawanya di contextInfo, posisinya beda-beda tergantung jenis
 * pesan (teks, gambar, video) dan bisa terbungkus ephemeral / view once.
 */
function cariInfoSaluran(obj, kedalaman = 0) {
  if (!obj || typeof obj !== "object" || kedalaman > 6) return null;
  if (obj.forwardedNewsletterMessageInfo?.newsletterJid) {
    return obj.forwardedNewsletterMessageInfo;
  }
  for (const nilai of Object.values(obj)) {
    const hasil = cariInfoSaluran(nilai, kedalaman + 1);
    if (hasil) return hasil;
  }
  return null;
}

/**
 * Pesan yang dibalas (quoted), dari contextInfo pesan perintah.
 * getContextInfo ikut membuka pembungkus ephemeral (grup pesan sementara).
 */
function ambilPesanDibalas(message) {
  return getContextInfo(message)?.quotedMessage || null;
}

// Deskripsi saluran bisa sangat panjang, cukup cuplikannya saja.
const MAKS_DESKRIPSI = 100;

/** Jadikan satu baris lalu potong di batas kata, mis. "Info update bot ..." */
function potongDeskripsi(teks) {
  const satuBaris = String(teks).replace(/\s+/g, " ").trim();
  if (satuBaris.length <= MAKS_DESKRIPSI) return satuBaris;
  const potong = satuBaris.slice(0, MAKS_DESKRIPSI);
  const spasi = potong.lastIndexOf(" ");
  return (spasi > MAKS_DESKRIPSI * 0.6 ? potong.slice(0, spasi) : potong) + "...";
}

function susunTeks(info, cadangan = {}) {
  const baris = [
    `🆔 *ID Saluran:* ${info.jid || cadangan.jid}`,
    `📛 *Nama:* ${info.name || cadangan.name || "-"}`,
  ];
  if (typeof info.subscribersCount === "number") {
    baris.push(`👥 *Pengikut:* ${info.subscribersCount.toLocaleString("id-ID")}`);
  }
  if (info.verification) {
    baris.push(`✅ *Terverifikasi:* ${info.verification === "VERIFIED" ? "Ya" : "Tidak"}`);
  }
  if (info.state) {
    baris.push(`📌 *Status:* ${TEKS_STATUS[info.state] || info.state}`);
  }
  if (info.creationTime) {
    const tanggal = new Date(info.creationTime * 1000).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    baris.push(`📅 *Dibuat:* ${tanggal}`);
  }
  if (info.invite) {
    baris.push(`🔗 *Link:* https://whatsapp.com/channel/${info.invite}`);
  }
  if (info.description) {
    baris.push(`📝 *Deskripsi:* ${potongDeskripsi(info.description)}`);
  }
  return `_✅ Informasi Saluran:_\n\n${baris.join("\n")}`;
}

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, prefix, command, content } = messageInfo;
  const teks = String(content || "").trim();

  try {
    const newsletter = sock.zapo?.newsletter;
    if (!newsletter) {
      return await reply(m, "_❌ Fitur saluran tidak tersedia di koneksi bot ini._");
    }

    const link = teks.match(POLA_LINK);
    const jid = teks.match(POLA_JID);
    // Balas pesan terusan dari saluran -> ID ada di info terusannya.
    const dariTerusan = !link && !jid ? cariInfoSaluran(ambilPesanDibalas(message)) : null;

    if (!link && !jid && !dariTerusan) {
      return await reply(
        m,
        `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _${prefix + command} https://whatsapp.com/channel/xxxxxxxxxxxx_` +
          `\n\n_Atau balas pesan yang diteruskan dari saluran dengan *${prefix + command}*_`
      );
    }

    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // GUEST: bot belum tentu mengikuti saluran tersebut.
    const opsi = { viewRole: "GUEST" };

    if (dariTerusan) {
      const cadangan = { jid: dariTerusan.newsletterJid, name: dariTerusan.newsletterName };
      let info = {};
      try {
        info = await newsletter.fetch(cadangan.jid, opsi);
      } catch (err) {
        // ID tetap bisa ditampilkan walau detailnya gagal diambil.
        console.warn("[IDCH] Detail saluran gagal diambil:", err.message);
      }
      return await reply(m, susunTeks(info, cadangan));
    }

    let info;
    try {
      info = link
        ? await newsletter.fetchByInvite(link[1], opsi)
        : await newsletter.fetch(jid[1], opsi);
    } catch (err) {
      console.warn("[IDCH] Saluran tidak ditemukan:", err.message);
      return await reply(
        m,
        "_❌ Saluran tidak ditemukan. Pastikan link / ID saluran benar dan salurannya masih ada._"
      );
    }

    if (!info?.jid) {
      return await reply(m, "_❌ Saluran tidak ditemukan._");
    }

    return await reply(m, susunTeks(info));
  } catch (error) {
    console.error("Kesalahan di fungsi handle:", error);
    logCustom("info", content, `ERROR-COMMAND-${command}.txt`);
    return await reply(m, `_❌ Error: ${error.message || "Terjadi kesalahan tak dikenal."}_`);
  }
}

export default {
  handle,
  Commands: ["idch", "cekidch", "idsaluran"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
