import fs from "fs";
import path from "path";
import { getGroupMetadata } from "../../lib/cache.js";

/**
 * Generate vCard format for a contact
 * @param {string} userId - The ID of the user (e.g., phone number or unique identifier).
 * @returns {string} - vCard formatted string.
 */
async function generateVCard(userId) {
  const displayName = `Pushkontak - ${userId.split("@")[0]}`;
  const phoneNumber = userId.split("@")[0];

  // Format vCard versi 3.0
  const vCard = `
BEGIN:VCARD
VERSION:3.0
FN:${displayName}
TEL;TYPE=CELL:${phoneNumber}
END:VCARD
    `.trim();
  return vCard;
}

/**
 * Handle command to save group contacts into a VCF file.
 */
async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;

  try {
    // Validasi input kosong atau tidak sesuai format
    if (!content || content.trim() === "") {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
            prefix + command
          } xxx@g.us*_`,
        },
        { quoted: message }
      );
    }

    // Kirim reaksi sementara untuk memberikan feedback
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Ambil metadata grup
    const Metadata = await getGroupMetadata(sock, content);
    if (!Metadata) {
      return await sock.sendMessage(
        remoteJid,
        { text: "Grup tidak ditemukan." },
        { quoted: message }
      );
    }

    // Ambil id atau phoneNumber dari peserta grup
    const allUsers = Metadata.participants
      .map((v) => v.id || v.phoneNumber) // ambil id jika ada, kalau tidak ambil phoneNumber
      .filter(Boolean); // buang yang undefined atau null

    if (allUsers.length === 0) {
      return await sock.sendMessage(
        remoteJid,
        { text: "Tidak ada kontak yang sesuai filter." },
        { quoted: message }
      );
    }

    // Buat file vCard
    let textVCF = "";
    for (let user of allUsers) {
      const vCard = await generateVCard(user);
      textVCF += `${vCard}\n`;
    }

    // Pastikan folder tujuan ada
    const saveDir = path.join(process.cwd(), "tmp"); // Menggunakan direktori kerja saat ini
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }

    // Simpan ke file .vcf
    const filePath = path.join(
      saveDir,
      `${content.split("@")[0]}_contacts.vcf`
    );
    fs.writeFileSync(filePath, textVCF, "utf8");

    await sock.sendMessage(
      remoteJid,
      {
        document: fs.readFileSync(filePath),
        fileName: `${content.split("@")[0]}_contacts.vcf`,
        mimetype: "text/vcard", // Atau 'text/x-vcard' jika Anda lebih suka
      },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error in handle function:", error);
    await sock.sendMessage(
      remoteJid,
      { text: `_Terjadi kesalahan: ${error.message}_` },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["savekontak"],
  OnlyPremium: false,
  OnlyOwner: true,
};
