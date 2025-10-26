import { findUser, updateUser } from "../../lib/users.js";

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, sender, command, prefix } = messageInfo;

  // Daftar role yang valid
  const roleArr = [
    "gamers",
    "coding",
    "conqueror",
    "100",
    "content creator",
    "fotografer",
    "music",
    "ilmuwan",
    "petualang",
    "hacker",
    "snake",
    "bull",
    "bear",
    "tiger",
    "cobra",
    "wolf",
    "imortal",
  ];

  // Validasi input kosong
  if (!content || !content.trim()) {
    const roleERR = `_Pilih Role Di Bawah:_\n\n${roleArr
      .map((role) => `◧ ${role}`)
      .join("\n")}\n\n_Contoh_: _*${prefix + command} music*_`;
    return await sock.sendMessage(
      remoteJid,
      { text: roleERR },
      { quoted: message }
    );
  }

  // Validasi role tidak ditemukan
  if (!roleArr.includes(content.toLowerCase())) {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ Role "${content}" tidak valid. Silakan pilih salah satu role di bawah:\n\n${roleArr
          .map((role) => `◧ ${role}`)
          .join("\n")}`,
      },
      { quoted: message }
    );
  }

  // Ambil data pengguna
  try {
    const dataUsers = findUser(sender);

    const [docId, userData] = dataUsers;

    // Validasi level pengguna
    if (userData.level < 10) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ _Untuk mengganti role akun, level minimal adalah 10._\n\n_Level kamu saat ini: ${userData.level}_`,
        },
        { quoted: message }
      );
    }

    // Update role pengguna
    updateUser(sender, { achievement: content });

    // Kirim pesan berhasil
    return await sock.sendMessage(
      remoteJid,
      {
        text: `✅ _Berhasil mengganti role akun ke_ "${content}".\n\n_Ketik *.me* untuk melihat detail akun._`,
      },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error saat memproses pengguna:", error);

    // Kirim pesan kesalahan
    return await sock.sendMessage(
      remoteJid,
      {
        text: "⚠️ Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.",
      },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["setakun"],
  OnlyPremium: false,
  OnlyOwner: false,
};
