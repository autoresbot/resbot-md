const on_fitur = false; // Jadikan true untuk mengaktifkan fitur

const badword = ["kontol", "memek", "puki", "babi", "bajingan", "anjing"]; // Kata badword

const pesan_badword =
  "⚠️ Mohon Maaf Kamu Akan di blokir karena mengirim pesan badword";

async function process(sock, messageInfo) {
  const { sender, isGroup, fullText, message } = messageInfo;

  if (isGroup || !on_fitur) return true; // Lewati jika dalam grup atau fitur nonaktif

  try {
    // Cek apakah teks mengandung kata terlarang
    if (badword.some((word) => fullText.toLowerCase().includes(word))) {
      await sock.sendMessage(
        sender,
        { text: pesan_badword },
        { quoted: message }
      );
      await sock.updateBlockStatus(sender, "block"); // Blokir pengguna
    }
  } catch (error) {
    console.error("Error in badword pribadi process:", error);
  }
}

export default {
  name: "Badword Pribadi",
  priority: 10,
  process,
};
