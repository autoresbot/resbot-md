import moment from "moment"; // pastikan moment sudah diinstall: npm install moment

async function handle(sock, messageInfo) {
  const { remoteJid, message, fullText, content, prefix, command } =
    messageInfo;

  if (!content) {
    return sock.sendMessage(
      remoteJid,
      {
        text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
          prefix + command
        } 12/01/2005*_`,
      },
      { quoted: message }
    );
  }

  // Ambil tanggal dari fullText setelah command
  const args = fullText.replace(prefix + command, "").trim();
  const birthDate = moment(args, "DD/MM/YYYY", true);

  if (!birthDate.isValid()) {
    return sock.sendMessage(
      remoteJid,
      {
        text: `_❌ Format tanggal tidak valid! Gunakan format: DD/MM/YYYY_\n\n_Contoh:_ *${
          prefix + command
        } 12/01/2005*`,
      },
      { quoted: message }
    );
  }

  const now = moment();
  const age = now.diff(birthDate, "years");
  const months = now.diff(birthDate, "months") % 12;

  const responseText = `📅 Umur kamu adalah *${age} tahun ${months} bulan*\n🗓️ Tanggal lahir: *${birthDate.format(
    "DD MMMM YYYY"
  )}*`;

  try {
    await sock.sendMessage(
      remoteJid,
      { text: responseText },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

export default {
  handle,
  Commands: ["cekumur"],
  OnlyPremium: false,
  OnlyOwner: false,
};
