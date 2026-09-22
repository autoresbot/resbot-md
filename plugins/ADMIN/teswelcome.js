import { getGroupMetadata, getProfilePictureUrl } from "../../lib/cache.js";
import { checkMessage, getWelcomeMedia } from "../../lib/participants.js";
import config from "../../config.js";
import fs from "fs";
import path from "path";
import axios from "axios";

async function handle(sock, messageInfo) {
  const { remoteJid, sender, message, pushName, prefix, command, isGroup } =
    messageInfo;
  let { content } = messageInfo;
  try {
    // Tanpa angka -> tampilkan setelan welcome grup ini apa adanya, supaya
    // admin bisa langsung mengecek hasil .setwelcome tanpa menghafal nomor.
    if (!content && isGroup) {
      content = String(
        (await checkMessage(remoteJid, "templatewelcome")) || config.typewelcome || "1"
      );

      // Foto/video milik grup sendiri (.setwelcome foto / video)
      if (content === "media") {
        const media = getWelcomeMedia(remoteJid);
        const filePath = media
          ? path.join(process.cwd(), "database", "media", media.file)
          : null;
        const teks = (await checkMessage(remoteJid, "add")) || "Selamat datang @name";

        if (!filePath || !fs.existsSync(filePath)) {
          await sock.sendMessage(
            remoteJid,
            {
              text: `⚠️ _File welcome tidak ditemukan. Atur ulang dengan *${prefix}setwelcome foto/video*_`,
            },
            { quoted: message }
          );
          return;
        }

        const buffer = fs.readFileSync(filePath);
        await sock.sendMessage(
          remoteJid,
          media.tipe === "video"
            ? { video: buffer, caption: teks, gifPlayback: media.gif === true }
            : { image: buffer, caption: teks },
          { quoted: message }
        );
        return;
      }
    }

    // Validasi input konten
    if (!content) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
            prefix + command
          } 1*_`,
        },
        { quoted: message }
      );
      return;
    }

    // Indikator proses
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Ambil metadata grup dan profil pengguna
    const groupMetadata = await getGroupMetadata(sock, remoteJid);
    const { size, subject, desc } = groupMetadata;
    const ppUser = await getProfilePictureUrl(sock, sender);
    const ppGroup = await getProfilePictureUrl(sock, remoteJid);

    let buffer;

    // Mapping content ke parameter API
    const apiRoutes = {
      // Template baru: cukup foto profil + nama
      default: {
        endpoint: "https://api.autoresbot.com/api/maker/welcome",
        params: {
          pp: ppUser,
          name: pushName,
          gcname: subject,
          member: size,
          ppgc: ppGroup,
        },
      },
      1: {
        endpoint: "https://api.autoresbot.com/api/maker/welcome1",
        params: {
          pp: ppUser,
          name: pushName,
          gcname: subject,
          member: size,
          ppgc: ppGroup,
        },
      },
      2: {
        endpoint: "https://api.autoresbot.com/api/maker/welcome2",
        params: {
          pp: ppUser,
          name: pushName,
          gcname: subject,
          member: size,
          ppgc: ppGroup,
          bg: "https://api.autoresbot.com/api/maker/bg-default",
        },
      },
      3: {
        endpoint: "https://api.autoresbot.com/api/maker/welcome3",
        params: {
          pp: ppUser,
          name: pushName,
          gcname: subject,
          desk: desc || "-",
          ppgc: ppGroup,
          bg: "https://api.autoresbot.com/api/maker/bg-default",
        },
      },
      4: {
        endpoint: "https://api.autoresbot.com/api/maker/welcome4",
        params: { pp: ppUser, name: pushName },
      },
      5: {
        endpoint: "https://api.autoresbot.com/api/maker/welcome5",
        params: { pp: ppUser, name: pushName },
      },
      6: {
        endpoint: "https://api.autoresbot.com/api/maker/welcome6",
        params: {
          pp: ppUser,
          name: pushName,
          gcname: subject,
          member: size,
          ppgc: ppGroup,
        },
      },
      7: {
        endpoint: "https://api.autoresbot.com/api/maker/welcome7",
        params: {
          pp: ppUser,
          name: pushName,
          gcname: subject,
          member: size,
          ppgc: ppGroup,
        },
      },
    };

    if (content == "text") {
      await sock.sendMessage(
        remoteJid,
        {
          text: `_Welcome bro di grub ${subject}_\n\n_Untuk menggunakan template ini silakan ketik_ *.templatewelcome ${content}*`,
        },
        { quoted: message }
      );
      return;
    }

    // Periksa apakah content valid
    const route = apiRoutes[content];
    if (!route) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format tidak valid! Pilih angka 1-7._ \n_atau *text*, atau *default* untuk template baru_`,
        },
        { quoted: message }
      );
      return;
    }
    try {
      const response = await axios.post(route.endpoint, route.params, {
        responseType: "arraybuffer", // Mengembalikan data sebagai buffer
      });
      buffer = Buffer.from(response.data);
    } catch (error) {
      if (error.response) {
        // Error dari server, ambil detail responsenya
        const status = error.response.status;
        const statusText = error.response.statusText;
        let responseData;

        try {
          // Coba parsing body response sebagai JSON
          responseData = JSON.parse(
            Buffer.from(error.response.data).toString()
          );
        } catch (parseErr) {
          // Kalau tidak bisa di-parse, tampilkan raw string
          responseData = Buffer.from(error.response.data).toString();
        }

        console.error(
          `Error fetching welcome buffer:
  Status: ${status} ${statusText}
  Response:`,
          responseData
        );
      } else if (error.request) {
        // Request dikirim, tapi tidak ada response
        console.error("No response received from API:", error.request);
      } else {
        // Kesalahan saat menyiapkan request
        console.error("Error in setting up the request:", error.message);
      }
      buffer = null;
    }

    // Kirim hasil ke pengguna
    await sock.sendMessage(
      remoteJid,
      {
        image: buffer,
        caption: `_Untuk menggunakan template ini silakan ketik_ *.templatewelcome ${content}*`,
      },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error in handle function:", error);
    await sock.sendMessage(
      remoteJid,
      {
        text: `_❌ Terjadi kesalahan: ${error.message}_`,
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["teswelcome"],
  OnlyPremium: false,
  OnlyOwner: false,
};
