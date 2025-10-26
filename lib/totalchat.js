import fs from "fs/promises";

const JSON_PATH = "./database/additional/totalchat.json";
const AUTOSAVE = 60; // 60 Detik

const today = new Date().toLocaleDateString("id-ID", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

let dbTotalChat = {}; // Database sementara di memori

// **Load data ke memori saat aplikasi dimulai**
async function loadTotalChat() {
  try {
    const data = await fs.readFile(JSON_PATH, "utf8");
    dbTotalChat = JSON.parse(data);
  } catch (error) {
    console.error(
      "❌ Gagal membaca totalchat.json, menggunakan data kosong:",
      error
    );
    dbTotalChat = {};
  }
}

async function saveJsonFiles() {
  try {
    await fs.writeFile(JSON_PATH, JSON.stringify(dbTotalChat, null, 2), "utf8");
  } catch (error) {
    console.error(`[saveJsonFiles] Error menyimpan file:`, error);
  }
}

// **Tambah jumlah chat pengguna dalam grup**
function incrementUserChatCount(groupId, userId) {
  if (!dbTotalChat[groupId]) {
    dbTotalChat[groupId] = { createdAt: today, members: {} };
  }

  if (!dbTotalChat[groupId].members[userId]) {
    dbTotalChat[groupId].members[userId] = 0;
  }

  dbTotalChat[groupId].members[userId] += 1;
}

// **Dapatkan jumlah chat pengguna dalam grup**
function getUserChatCount(groupId, userId) {
  return dbTotalChat[groupId]?.members[userId] || 0;
}

// **Dapatkan total chat semua pengguna dalam grup**
function getTotalChatPerGroup(groupId) {
  return dbTotalChat[groupId]?.members || {};
}

// **Reset total chat dalam grup tertentu**
async function resetTotalChatPerGroup(groupId) {
  if (!dbTotalChat[groupId]) return false;

  dbTotalChat[groupId] = { createdAt: today, members: {} };
  await saveJsonFiles();
  return true;
}

// **Reset total chat seluruh grup**
async function resetAllTotalChat() {
  dbTotalChat = {};
  await saveJsonFiles();
}

setInterval(saveJsonFiles, AUTOSAVE * 1000); // Simpan otomatis

// **Load data saat aplikasi dijalankan**
loadTotalChat();

export {
  incrementUserChatCount,
  getUserChatCount,
  getTotalChatPerGroup,
  resetTotalChatPerGroup,
  resetAllTotalChat,
};
