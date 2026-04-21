import { reply } from "../../lib/utils.js";
import fs from "fs";
import path from "path";

async function handle(sock, messageInfo) {
  const { m, prefix, command, content } = messageInfo;

  if (!content) {
    return await reply(
      m,
      `_Masukkan format yang valid_\n\n_Contoh:_ *${
        prefix + command
      } plugins/menu.js*`
    );
  }

  // Batas direktori: folder kerja bot
  const baseDir = path.resolve(process.cwd());
  const targetPath = path.resolve(baseDir, content);

  // Proteksi agar tidak bisa keluar dari folder kerja
  if (!targetPath.startsWith(baseDir)) {
    return await reply(m, "_Akses file ditolak: path tidak valid._");
  }

  // Validasi file
  if (!fs.existsSync(targetPath)) {
    return await reply(m, `_File tidak ditemukan:_ *${content}*`);
  }

  if (path.extname(targetPath) !== ".js") {
    return await reply(m, `_Hanya file .js yang diperbolehkan_`);
  }

  try {
    const fileContent = fs.readFileSync(targetPath, "utf-8");

    // Jika isi file terlalu panjang, kirim sebagai dokumen
    if (fileContent.length > 4000) {
      await reply(m, "_Isi file terlalu panjang, dikirim sebagai dokumen..._");
      return await sock.sendMessage(
        m.key.remoteJid,
        {
          document: fs.readFileSync(targetPath),
          fileName: path.basename(targetPath),
          mimetype: "text/javascript",
        },
        { quoted: m }
      );
    }

    // Kirim isi file sebagai teks
    return await reply(
      m,
      `📄 *Isi file:* _${content}_\n\n` + "```js\n" + fileContent + "\n```"
    );
  } catch (err) {
    console.error(err);
    return await reply(m, "_Gagal membaca file._");
  }
}

export default {
  handle,
  Commands: ["viewcode"],
  OnlyPremium: false,
  OnlyOwner: true,
};
