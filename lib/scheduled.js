
import moment from "moment-timezone";
import path from "path";
import schedule from "node-schedule";
import fs from "fs";
import mess from "../strings.js";
import config from "../config.js";
import { exec } from "child_process";
import { readGroup } from "./group.js";
import { getJadwalSholat } from "./features.js";
import {
  logWithTime,
  convertTime,
  getTimeRemaining,
  logTracking,
} from "./utils.js";


const STATUS_SCHEDULED = config.scheduled || false; // true atau false


let lastCallTime = 0;

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getGroupMetadataSafe(sock, groupId) {
  const now = Date.now();
  const elapsed = now - lastCallTime;

  if (elapsed < 1000) {
    await delay(1000 - elapsed); // Tunggu sampai 1 detik berlalu
  }

  lastCallTime = Date.now(); // Update waktu panggilan terakhir

  try {
    logTracking(`scheduled.js - groupMetadata (${groupId})`);
    const metadata = await sock.groupMetadata(groupId);
    return metadata || null;
  } catch (err) {
    console.error(
      "1: Gagal mengambil metadata grup:",
      groupId,
      "-",
      err.message || err
    );
    return null;
  }
}

let currentSock = null; // Variabel global untuk menyimpan sock terbaru

async function updateSocket(newSock) {
  if (!STATUS_SCHEDULED) {
    return;
  }

  // Membatalkan semua job
  Object.keys(schedule.scheduledJobs).forEach((jobName) => {
    schedule.scheduledJobs[jobName].cancel();
  });

  currentSock = newSock;
  await rescheduleGroups(currentSock);
  await waktuSholat(currentSock);
  if (config.midnight_restart) {
    await restaringServer(currentSock);
  }
}

async function rescheduleGroups(sock) {
  const jsonPath = path.resolve(
    process.cwd(),
    "./database/additional/group participant.json"
  );

  // Validasi keberadaan file
  if (!fs.existsSync(jsonPath)) {
    console.error(`File tidak ditemukan: ${jsonPath}`);
    return;
  }

  const schedules = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  // Iterasi pada objek schedules
  for (const [groupId, groupData] of Object.entries(schedules)) {
    // Jadwalkan openTime
    if (groupData.openTime) {
      logWithTime(
        "System",
        `Penjadwalan harian buka grup ${groupId} pada jam ${groupData.openTime}`
      );

      // Pecah waktu buka menjadi jam dan menit
      const [openHour, openMinute] = groupData.openTime.split(":").map(Number);

      if (!isNaN(openHour) && !isNaN(openMinute)) {
        // Konversi waktu ke zona Asia/Jakarta
        const timeInWIB = moment.tz(
          { hour: openHour, minute: openMinute },
          "Asia/Jakarta"
        );

        if (timeInWIB.isValid()) {
          // Konversi waktu Asia/Jakarta ke waktu server
          const serverTime = convertTime(`${openHour}:${openMinute}`);
          const [convertedHour, convertedMinute] = serverTime
            .split(":")
            .map(Number);

          // Buat pola untuk penjadwalan harian
          const jobName = `openTime-${serverTime}-${groupId}`;
          const schedulePattern = `${convertedMinute} ${convertedHour} * * *`;

          // Jadwalkan tugas
          schedule.scheduleJob(jobName, schedulePattern, () => {
            try {
              openGroup(sock, groupId);
            } catch (err) {
              logWithTime(
                "Error",
                `Error menjalankan openGroup untuk grup ${groupId}: ${err.message}`
              );
            }
          });
        } else {
          console.error(
            `Waktu buka tidak valid untuk grup ${groupId}: ${groupData.openTime}`
          );
        }
      } else {
        console.error(
          `Format waktu buka tidak valid untuk grup ${groupId}: ${groupData.openTime}`
        );
      }
    }

    // Jadwalkan closeTime
    if (groupData.closeTime) {
      logWithTime(
        "System",
        `Penjadwalan closeTime untuk grup ${groupId} pada jam ${groupData.closeTime}`
      );

      // Pecah waktu tutup menjadi jam dan menit
      const [closeHour, closeMinute] = groupData.closeTime
        .split(":")
        .map(Number);

      const serverTime = convertTime(`${closeHour}:${closeMinute}`);

      const [convertedHour, convertedMinute] = serverTime
        .split(":")
        .map(Number);

      if (!isNaN(closeHour) && !isNaN(closeMinute)) {
        // Konversi waktu ke zona Asia/Jakarta
        const timeInWIB = moment.tz(
          { hour: closeHour, minute: closeMinute },
          "Asia/Jakarta"
        );

        if (timeInWIB.isValid()) {
          // Jadwalkan tugas untuk dijalankan setiap hari
          const jobName = `closeTime-${timeInWIB}-${groupId}`;
          const schedulePattern = `${convertedMinute} ${convertedHour} * * *`;
          schedule.scheduleJob(jobName, schedulePattern, () => {
            closeGroup(sock, groupId);
          });
        } else {
          console.error(
            `Waktu tutup tidak valid untuk grup ${groupId}: ${groupData.closeTime}`
          );
        }
      } else {
        console.error(
          `Format waktu tutup tidak valid untuk grup ${groupId}: ${groupData.closeTime}`
        );
      }
    }
  }
}

const queue = []; // Antrean untuk mengatur pengiriman

async function sendNotifWithDelay(sock, groupId, waktu) {
  queue.push({ sock, groupId, waktu });

  if (queue.length === 1) {
    while (queue.length > 0) {
      const { sock, groupId, waktu } = queue[0];
      await sendNotif(sock, groupId, waktu);
      queue.shift(); // Hapus item dari antrean setelah diproses
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Jeda 2 detik sebelum mengirim ke grup berikutnya
    }
  }
}

async function sendNotif(sock, groupId, waktu) {
  logWithTime("System", `sendNotif di jalankan ${waktu} - ${groupId}`);
  try {
    const metadata = await getGroupMetadataSafe(sock, groupId);
    if (!metadata) return;

    // Kondisi jika waktunya sahur
    if (waktu == "sahur") {
      const arr = [
        `🕰️ _Saatnya sahur!_\n\n🍚 Yuk, makan sahur agar tetap berenergi sepanjang hari. Jangan lupa minum air yang cukup! 💧`,
        `📢 _Pengingat Sahur:_\n\n🌅 Waktu sahur sudah masuk di tiba. Ayo persiapkan makanan sehat dan jangan lupa berdoa sebelum makan. 🤲`,
        `✨ _Berkah sahur telah datang!_\n\n🥣 Makan sahur itu sunnah dan penuh berkah. Yuk, jangan sampai terlewat! Semoga puasamu lancar hari ini. 😊`,
        `🍽️ _Waktunya sahur!_\n\nJangan lupa bangun dan makan sahur, karena Rasulullah menganjurkannya sebagai sumber keberkahan. 🌟`,
      ];
      const randomMessage = arr[Math.floor(Math.random() * arr.length)];
      const result = await sock.sendMessage(groupId, { text: randomMessage });

      const filePath = path.join(
        process.cwd(),
        "database",
        "audio",
        "sahur.m4a"
      );
      try {
        // Baca file sebagai buffer
        const audioBuffer = fs.readFileSync(filePath);
        // Kirim audio sahur
        await sock.sendMessage(
          groupId,
          {
            audio: audioBuffer,
            mimetype: "audio/mp4",
          },
          { quoted: result }
        );
      } catch (err) {
        console.error("Error reading file:", err);
      }
      return;
    }

    const arr = [
      `🕌 _Waktu ${waktu} telah tiba di wilayah Jakarta dan sekitarnya._\n\n_Mari bersiap mengambil 💧 air wudu dan melaksanakan ibadah sholat. 🤲 Semoga Allah menerima amal ibadah kita._`,
      `🕋 Waktu ${waktu} sudah masuk di Jakarta dan sekitarnya.\n💧 Yuk, ambil air wudu dan laksanakan sholat.\n✨ Jangan lupa, sholat tepat waktu itu berkah! 😊`,
      `🌅 _Saatnya menunaikan sholat ${waktu} untuk wilayah Jakarta dan sekitarnya._\n\n💧 Ambil wudu dan laksanakan dengan khusyuk. Semoga hari kita diberkahi! 🤲`,
      `📢 _Pengingat waktu sholat:_\n\n🕌 _Waktu ${waktu} telah tiba di Jakarta dan sekitarnya._\n💧 Ayo ambil air wudu dan tunaikan kewajiban kita!`,
      `✨ _Waktunya untuk mendekatkan diri kepada Allah._\n\n🕌 _Sholat ${waktu} telah tiba di Jakarta dan sekitarnya._\n💧 Mari bersiap dengan mengambil wudu. Semoga keberkahan menyertai kita semua.`,
    ];

    // Pilih pesan secara acak
    const randomMessage = arr[Math.floor(Math.random() * arr.length)];

    // Kirim pesan
    const result = await sock.sendMessage(groupId, { text: randomMessage });

    // Pilih audio azan berdasarkan waktu
    const azanAudioUrl =
      waktu === "subuh"
        ? "https://api.autoresbot.com/mp3/azan-subuh.m4a"
        : "https://api.autoresbot.com/mp3/azan-umum.m4a";

    // Kirim audio azan
    await sock.sendMessage(
      groupId,
      {
        audio: { url: azanAudioUrl },
        mimetype: "audio/mp4",
      },
      { quoted: result }
    );

    logWithTime(
      "System",
      `Berhasil Mengirim waktu sholat untuk grub ${groupId}`
    );
  } catch (error) {
    logWithTime(
      "System",
      `Gagal mengirimkan notif sholat di grup ${groupId}: ${error.message}`
    );
    console.error(
      `Gagal mengirimkan notif sholat di grup ${groupId}: ${error.message}`
    );
  }
}

async function waktuSholat(sock) {
  try {
    // Ambil data jadwal sholat
    const dataSholat = await getJadwalSholat(); // { subuh, dzuhur, ashar, maghrib, isya }
    const dataGroupSettings = await readGroup();
    if (!dataGroupSettings) {
      return false;
    }

    const groupIds = Object.keys(dataGroupSettings).filter(
      (groupId) => dataGroupSettings[groupId]?.fitur?.waktusholat
    );
    if (groupIds.length === 0) {
      return false;
    }

    // Iterasi waktu sholat untuk membuat jadwal baru
    for (const [waktu, jam] of Object.entries(dataSholat)) {
      const [hour, minute] = jam.split(":").map(Number);
      if (isNaN(hour) || isNaN(minute)) {
        console.error(`Format waktu sholat tidak valid untuk ${waktu}: ${jam}`);
        continue;
      }

      const delayBetweenNotif = 3000;

      // Jadwalkan untuk setiap grup
      for (const groupId of groupIds) {
        const jobName = `jadwalsholat-${waktu}-${groupId}`;

        // 💡 Gunakan langsung waktu WIB tanpa konversi UTC
        const schedulePattern = `${minute} ${hour} * * *`;

        let delay = 0; // Mulai dari tanpa delay

        schedule.scheduleJob(jobName, schedulePattern, async () => {
          setTimeout(async () => {
            await sendNotifWithDelay(sock, groupId, waktu);
            console.log(
              `🔔 Notifikasi ${waktu} dikirim ke ${groupId} pada ${hour}:${minute} WIB`
            );
          }, delay);
          delay += delayBetweenNotif;
        });
      }
    }
  } catch (error) {
    logWithTime("System", `Error in waktuSholat: ${error.message}`);
    console.error("Error in waktuSholat:", error.message);
  }
}

async function restaringServer(sock) {
  try {
    logWithTime("System", "Menyiapkan penjadwalan restaring pada jam 12 malam");

    // Jadwalkan ulang restart pada jam 12 malam
    const jobName = `restaring-server`;
    schedule.scheduleJob(jobName, "0 0 * * *", async () => {
      try {
        logWithTime("System", "Restarting system otomatis ...");
        await restaringAction();
      } catch (error) {
        logWithTime("System", `Error during restart: ${error.message}`);
        console.error("Error during restart:", error);
      }
    });

    logWithTime("System", "Penjadwalan restaring berhasil diatur");
  } catch (error) {
    logWithTime("System", `Error in restaring:: ${error.message}`);
    console.error("Error in restaring:", error.message);
  }
}

async function closeGroup(sock, groupId) {
  try {
    const metadata = await getGroupMetadataSafe(sock, groupId);
    if (!metadata) return;

    await sock.groupSettingUpdate(groupId, "announcement");
    await sock.sendMessage(groupId, { text: mess.action.grub_close });
  } catch (error) {
    await sock.sendMessage(groupId, {
      text: `⚠️ _Gagal menutup grup:_ ${error.message}`,
    });
    console.error(`Gagal menutup grup ${groupId}: ${error.message}`);
  }
}

async function openGroup(sock, groupId) {
  try {
    const metadata = await getGroupMetadataSafe(sock, groupId);
    if (!metadata) return;

    await sock.groupSettingUpdate(groupId, "not_announcement");
    await sock.sendMessage(groupId, { text: mess.action.grub_open });
  } catch (error) {
    console.error(`Gagal membuka grup ${groupId}: ${error.message}`);
    await sock.sendMessage(groupId, {
      text: `⚠️ _Gagal membuka grup:_ ${error.message}`,
    });
  }
}

async function restaringAction() {
  try {
    exec(`node index`);
  } catch (error) {
    console.error("Terjadi kesalahan:", error);
    logWithTime("System", "Kesalahan saat restart otomatis");
  }
}

export { updateSocket, rescheduleGroups, waktuSholat };
