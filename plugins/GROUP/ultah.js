import { findUser, updateUser, addUser } from '../../lib/users.js';

async function handle(sock, messageInfo) {
  const { remoteJid, message, senderLid, content } = messageInfo;

  if (!content) {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `🎂 *Set Tanggal Ulang Tahun*\n\nFormat:\n.ultah Tanggal-Bulan-Tahun\n\nContoh:\n.ultah 12-05-2000`,
      },
      { quoted: message },
    );
  }

  const birthday = content.trim();

  // validasi format DD-MM-YYYY
  const regex = /^\d{1,2}-\d{1,2}-\d{4}$/;
  if (!regex.test(birthday)) {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `❌ Format salah!\nGunakan format *Tanggal-Bulan-Tahun*\nContoh: .ultah 12-05-2000`,
      },
      { quoted: message },
    );
  }

  const [dayStr, monthStr, yearStr] = birthday.split('-');
  const day = parseInt(dayStr);
  const month = parseInt(monthStr);
  const year = parseInt(yearStr);

  // validasi tahun
  const currentYear = new Date().getFullYear();
  if (year < 1900 || year > currentYear) {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `❌ Tahun tidak valid!\nTahun harus antara *1900 - ${currentYear}*.`,
      },
      { quoted: message },
    );
  }

  // validasi bulan
  if (month < 1 || month > 12) {
    return await sock.sendMessage(
      remoteJid,
      { text: `❌ Bulan tidak valid!\nBulan harus antara *1 - 12*.` },
      { quoted: message },
    );
  }

  // validasi tanggal
  const maxDay = new Date(year, month, 0).getDate();
  if (day < 1 || day > maxDay) {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `❌ Tanggal tidak valid!\nTanggal harus antara *1 - ${maxDay}* untuk bulan ${month}.`,
      },
      { quoted: message },
    );
  }

  const formattedBirthday = `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`;

  const dataUsers = await findUser(senderLid);

  if (dataUsers) {
    await updateUser(senderLid, {
      birthday: formattedBirthday,
      birthYear: year,
    });

    return await sock.sendMessage(
      remoteJid,
      {
        text: `🎉 Tanggal ulang tahun kamu berhasil disimpan!\n📅 ${formattedBirthday}-${year}`,
      },
      { quoted: message },
    );
  } else {
    await addUser(senderLid, {
      birthday: formattedBirthday,
      birthYear: year,
    });

    return await sock.sendMessage(
      remoteJid,
      {
        text: `🎉 Data kamu berhasil dibuat!\n📅 Ulang tahun: ${formattedBirthday}-${year}`,
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
