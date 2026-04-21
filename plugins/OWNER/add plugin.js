import { reply } from "../../lib/utils.js";
import fs from "fs";
import path from "path";

async function handle(sock, messageInfo) {
  const { m, prefix, command, content } = messageInfo;

  // Memisahkan konten berdasarkan tanda '|'
  const parts = content.split("|").map((part) => part.trim());

  if (parts.length < 2) {
    return await reply(
      m,
      `_Masukkan format yang valid_\n\n_Contoh:_ _*${
        prefix + command
      } newfitur*_ | async function handle(sock, messageInfo) {\n    const { remoteJid, message } = messageInfo;\n    await sock.sendMessage(remoteJid, { text: 'tes new fitur' }, { quoted: message });\n}
            
export default {
    handle,
    Commands: ['newfitur'],
    OnlyPremium: false,
    OnlyOwner: false,
};`
    );
  }

  // Bagian pertama adalah nama perintah baru (newCommand)
  let newCommand = parts[0];

  // Periksa apakah newCommand tidak diakhiri dengan '.js'
  if (!newCommand.endsWith(".js")) {
    newCommand += ".js"; // Tambahkan '.js' jika tidak ada
  }

  // Gabungkan semua elemen setelah elemen pertama untuk mendapatkan sisa teks sebagai isi fungsi (functionBody)
  const functionBody = parts.slice(1).join("|");

  // Menggunakan cwd (current working directory)
  const folderPath = path.join(process.cwd(), "./plugins/FEATURES ADD/");

  // Pastikan folder tujuan ada
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  // Membuat isi file berdasarkan newCommand dan functionBody
  const fileContent = functionBody;

  // Menulis file baru dengan nama sesuai newCommand
  const filePath = path.join(folderPath, `${newCommand}`);
  fs.writeFileSync(filePath, fileContent);

  return await reply(
    m,
    `_Plugin baru dengan nama *${newCommand}* berhasil dibuat!_\n\n_Restart server untuk menerapkan perubahan_`
  );
}

export default {
  handle,
  Commands: ["addplugin", "addplugins"],
  OnlyPremium: false,
  OnlyOwner: true,
};
