import { reply } from "../../lib/utils.js";
import { addOwner } from "../../lib/users.js";

async function handle(sock, messageInfo) {
  const { m, prefix, command, content } = messageInfo;

  // Validasi input kosong
  if (!content || !content.trim()) {
    return await reply(
      m,
      `_Masukkan format yang valid_\n\n_Contoh: *${prefix + command} 628xxx*_`
    );
  }

  // Membersihkan input menjadi hanya angka
  const ownerNumber = content.replace(/\D/g, ""); // Menghapus karakter non-angka

  // Validasi format nomor (10-15 digit)
  if (!/^\d{10,15}$/.test(ownerNumber)) {
    return await reply(
      m,
      `_Nomor tidak valid. Pastikan formatnya benar_\n\n_Contoh: *${
        prefix + command
      } 628xxx*_`
    );
  }

  // Menambahkan nomor ke daftar owner
  try {
    const result = addOwner(ownerNumber);
    if (result) {
      return await reply(
        m,
        `_Nomor ${ownerNumber} berhasil ditambahkan sebagai owner._`
      );
    } else {
      return await reply(
        m,
        `_Nomor ${ownerNumber} sudah ada dalam daftar owner._`
      );
    }
  } catch (error) {
    console.error("Error saat menambahkan owner:", error);
    return await reply(m, `_Terjadi kesalahan saat memproses permintaan._`);
  }
}

export default {
  handle,
  Commands: ["addowner"],
  OnlyPremium: false,
  OnlyOwner: true,
};
