import { addSewa, findSewa } from "../../lib/sewa.js";
import config from "../../config.js";
import { selisihHari, hariini } from "../../lib/utils.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, sender, prefix, command } = messageInfo;

  // Validasi input kosong atau tidak sesuai format
  if (!content || content.trim() === "") {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
          prefix + command
        } https://chat.whatsapp.com/xxx 30*_\n\n_*30* artinya penambahan 30 hari dihitung dari sisa waktu sewabot_\n\n_Jika Bot Belum Bergabung ke Grub Sewa Silakan ketik *.sewabot*_`,
      },
      { quoted: message }
    );
  }

  // Split content menjadi array untuk memisahkan link dan jumlah hari
  const args = content.trim().split(" ");
  if (args.length < 2) {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ Format tidak valid. Contoh penggunaan:\n\n_*${
          prefix + command
        } https://chat.whatsapp.com/xxx 30*_`,
      },
      { quoted: message }
    );
  }

  const linkGrub = args[0]; // Ambil link grup
  const totalHari = parseInt(args[1], 10); // Konversi hari menjadi angka

  // Validasi link grup
  if (!linkGrub.includes("chat.whatsapp.com")) {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ Link grup harus mengandung 'chat.whatsapp.com'. Contoh penggunaan:\n\n_*${
          prefix + command
        } https://chat.whatsapp.com/xxx 30*_`,
      },
      { quoted: message }
    );
  }

  // Validasi jumlah hari
  if (isNaN(totalHari) || totalHari <= 0) {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ Jumlah hari tidak valid. Contoh penggunaan:\n\n_*${
          prefix + command
        } https://chat.whatsapp.com/xxx 30*_`,
      },
      { quoted: message }
    );
  }

  // Ekstraksi kode grup dari link
  const result_sewa = linkGrub.split("https://chat.whatsapp.com/")[1];
  let res_linkgc = "";

  const currentDate = new Date();
  const expirationDate = new Date(
    currentDate.getTime() + totalHari * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000
  );
  const timestampExpiration = expirationDate.getTime();

  try {
    const res = await sock.query({
      tag: "iq",
      attrs: { type: "get", xmlns: "w:g2", to: "@g.us" },
      content: [{ tag: "invite", attrs: { code: result_sewa } }],
    });

    res_linkgc = res.content[0].attrs.id;
    const res_namegc = res.content[0].attrs.subject;
    res_linkgc = res_linkgc + "@g.us";

    // cek apakah data ada
    const cekSewa = await findSewa(res_linkgc);
    if (!cekSewa) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ _*Nomor Bot Belum Pernah Bergabung*_\n\n_Silakan Ketik *.sewabot* untuk membuat Sewa Baru_`,
        },
        { quoted: message }
      );
    }

    await sock
      .groupAcceptInvite(result_sewa)
      .then((res) => console.log(""))
      .catch((err) => console.log(""));

    const totalSewa =
      cekSewa.expired + totalHari * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000;

    await addSewa(res_linkgc, {
      linkGrub: linkGrub,
      expired: totalSewa,
    });

    // Kirim pesan berhasil
    return await sock.sendMessage(
      remoteJid,
      {
        text:
          `_*Perpanjangan Berhasil*_` +
          `\n\nName Grub : *${res_namegc}*` +
          `\nNomor Bot : ${config.phone_number_bot}` +
          `\nExpired : *${selisihHari(totalSewa)}*` +
          `\n\n_Untuk Mengecek status sewa ketik *.ceksewa* pada grub tersebut_`,
      },
      { quoted: message }
    );
  } catch (error) {
    console.error("Gagal bergabung ke grup:", error);

    // Pesan error default
    let info = "_Pastikan link grup valid._";

    // Periksa pesan error
    if (error instanceof Error && error.message.includes("not-authorized")) {
      info = `_Kemungkinan Anda pernah dikeluarkan dari grup. Solusi: undang bot kembali atau masukkan secara manual._`;
    }

    // Kirim pesan error ke pengguna
    return await sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ _Gagal bergabung ke grup._\n\n${info}`,
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["tambahsewa"],
  OnlyPremium: false,
  OnlyOwner: true,
};
