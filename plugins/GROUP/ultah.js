import { findUser, updateUser, addUser } from '../../lib/users.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message, sender, content } = messageInfo;

  if (!content) {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `🎂 *Set Tanggal Ulang Tahun*\n\nFormat:\n.ultah Tanggal-Bulan\n\nContoh:\n.ultah 12-05`,
      },
      { quoted: message },
    );
  }

  const birthday = content.trim();

  // validasi format
  const regex = /^\d{1,2}-\d{1,2}$/;
  if (!regex.test(birthday)) {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `❌ Format salah!\nGunakan format *Tanggal-Bulan*\nContoh: .ultah 12-05`,
      },
      { quoted: message },
    );
  }

  const [dayStr, monthStr] = birthday.split('-');
  const day = parseInt(dayStr);
  const month = parseInt(monthStr);

  // validasi bulan
  if (month < 1 || month > 12) {
    return await sock.sendMessage(
      remoteJid,
      { text: `❌ Bulan tidak valid!\nBulan harus antara *1 - 12*.` },
      { quoted: message },
    );
  }

  // validasi tanggal
  if (day < 1 || day > 31) {
    return await sock.sendMessage(
      remoteJid,
      { text: `❌ Tanggal tidak valid!\nTanggal harus antara *1 - 31*.` },
      { quoted: message },
    );
  }

  const formattedBirthday = `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`;

  const dataUsers = await findUser(sender);

  if (dataUsers) {
    await updateUser(sender, {
      birthday: formattedBirthday,
    });

    return await sock.sendMessage(
      remoteJid,
      {
        text: `🎉 Tanggal ulang tahun kamu berhasil disimpan!\n📅 ${formattedBirthday}`,
      },
      { quoted: message },
    );
  } else {
    await addUser(sender, {
      birthday: formattedBirthday,
    });

    return await sock.sendMessage(
      remoteJid,
      {
        text: `🎉 Data kamu berhasil dibuat!\n📅 Ulang tahun: ${formattedBirthday}`,
      },
      { quoted: message },
    );
  }
}

export default {
  handle,
  Commands: ['ultah'],
  OnlyPremium: false,
  OnlyOwner: false,
};
