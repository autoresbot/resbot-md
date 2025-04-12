/*
⚠️ PERINGATAN:
Script ini **TIDAK BOLEH DIPERJUALBELIKAN** dalam bentuk apa pun!

╔══════════════════════════════════════════════╗
║                🛠️ INFORMASI SCRIPT           ║
╠══════════════════════════════════════════════╣
║ 📦 Version   : 4.1.6
║ 👨‍💻 Developer  : Azhari Creative              ║
║ 🌐 Website    : https://autoresbot.com       ║
║ 💻 GitHub     : github.com/autoresbot/resbot ║
╚══════════════════════════════════════════════╝

📌 Mulai 11 April 2025,
Script **Autoresbot** resmi menjadi **Open Source** dan dapat digunakan secara gratis:
🔗 https://autoresbot.com
*/

const moment = require("moment-timezone");

const CONNECTION = "pairing"; // qr atau pairing
const OWNER_NAME = "Razael";
const NOMOR_BOT = "6282138458638"; // 628xx nomor wa
const DESTINATION = "group"; // group , private, both
const APIKEY = "8791705a23f6ece7e4d6e8f6"; // apikey dari autoresbot.com (premium akun)
const RATE_LIMIT = 3000; // 3 detik/chat
const SIMILARITY = true; // Pencarian kemiripan command (true, false)
const MODE = "production"; // [production, development] (jangan di ubah kecuali anda developer)
const VERSION = global.version; // don't edit

const EMAIL = "tidak ada";
const REGION = "Indonesia";
const WEBSITE = "tidak ada";
const DATA_OWNER = ["6282138458638", "6282225907841"]; // bisa juga edit di database/owner.json

// Konfiqurasi Chat
const ANTI_CALL = true; // jika true (setiap yang nelpon pribadi akan di block)
const AUTO_READ = true; // jika true (setiap chat akan di baca/centang 2 biru)
const AUTO_BACKUP = true; // jika true (setiap restart server, data backup di kirimkan ke wa owner);
const MIDNIGHT_RESTART = false; // Restart setiap jam 12 malam
const PRESENCE_UPDATE = ""; // unavailable, available, composing, recording, paused
const TYPE_WELCOME = "4"; // 1, 2, 3, 4, 5, 6 text dan random
const BG_WELCOME2 = "https://api.autoresbot.com/api/maker/bg-default";

// Konfiqurasi Panel
const PANEL_URL = "https://adminhosting.sellingstore.cloud";
const PANEL_PLTA = "ptla_TsLN13sWMXBeyxXzKalPlIKF5UAtrEmkWdQIwvjfsom";
const PANEL_DESCRIPTION = `Butuh Bantuan Hubungi ${DATA_OWNER[1]}`;
const PANEL_ID_EGG = 16;
const PANEL_ID_LOCATION = 1;
const PANEL_DEFAULT_DISK = 10240; // 5GB atau 0 (unlimited)
const PANEL_DEFAULT_CPU = 500;

// antibadword di grub
const BADWORD_WARNING = 3; // Jumlah maksimum peringatan sebelum tindakan diambil
const BADWORD_ACTION = "both"; // tindakan setelah warning terpenuhi (kick, block, both)

// antispam di grub
const SPAM_LIMIT = 3; // Batas pesan dianggap spam
const SPAM_COULDOWN = 10; // Waktu cooldown dalam detik (10 detik)
const SPAM_WARNING = 3; // Jumlah maksimum peringatan sebelum tindakan diambil
const SPAM_ACTION = "both"; // tindakan setelah warning terpenuhi (kick, block, both)

const config = {
    APIKEY,
    phone_number_bot: NOMOR_BOT,
    type_connection: CONNECTION,
    bot_destination: DESTINATION,
    owner_name: OWNER_NAME,
    owner_number: DATA_OWNER,
    owner_website: WEBSITE,
    owner_email: EMAIL,
    region: REGION,
    version: VERSION,
    rate_limit: RATE_LIMIT,
    status_prefix: true, // wajib prefix : atau false tanpa prefix
    prefix: [".", "!", "#"],
    sticker_packname: OWNER_NAME,
    sticker_author: `Date: ${moment.tz("Asia/Jakarta").format("DD/MM/YY")}`,
    mode: MODE,
    commandSimilarity: SIMILARITY,
    anticall: ANTI_CALL,
    autoread: AUTO_READ,
    autobackup: AUTO_BACKUP,
    PresenceUpdate: PRESENCE_UPDATE,
    typewelcome: TYPE_WELCOME,
    bgwelcome2: BG_WELCOME2,
    midnight_restart: MIDNIGHT_RESTART,
    PANEL: {
        URL: PANEL_URL,
        KEY_APPLICATION: PANEL_PLTA,
        description: PANEL_DESCRIPTION,
        SERVER_EGG: PANEL_ID_EGG,
        id_location: PANEL_ID_LOCATION,
        default_disk: PANEL_DEFAULT_DISK,
        cpu_default: PANEL_DEFAULT_CPU
    },
    SPAM: {
        limit: SPAM_LIMIT,
        couldown: SPAM_COULDOWN,
        warning: SPAM_WARNING,
        action: SPAM_ACTION
    },
    BADWORD: {
        warning: BADWORD_WARNING,
        action: BADWORD_ACTION
    }
};

module.exports = config;
