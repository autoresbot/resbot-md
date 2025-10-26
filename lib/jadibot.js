import fs from "fs";
import fsp from "fs/promises"; // fs.promises untuk operasi async
import path from "path";
import { fileURLToPath } from "url";

// Agar bisa pakai __dirname di ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pathJson = path.join(__dirname, "../database/jadibot.json");

async function fileExists(path) {
  try {
    await fsp.access(path);
    return true;
  } catch {
    return false;
  }
}

async function listJadibot() {
  if (!(await fileExists(pathJson))) {
    await fsp.writeFile(pathJson, JSON.stringify({}, null, 2), "utf8"); // Buat file jika belum ada
  }
  const data = await fsp.readFile(pathJson, "utf8");
  return JSON.parse(data);
}

async function deleteJadibot(number) {
  let jadibots = await listJadibot();
  if (jadibots[number]) {
    delete jadibots[number];
    await fsp.writeFile(pathJson, JSON.stringify(jadibots, null, 2), "utf8");
    return true;
  } else {
    console.log("Number not found");
    return false;
  }
}

async function getJadibot(number) {
  let jadibots = await listJadibot();
  return jadibots[number] || null;
}

async function updateJadibot(number, status) {
  let jadibots = await listJadibot();
  if (jadibots[number]) {
    jadibots[number].status = status;
  } else {
    jadibots[number] = { status: status };
  }
  await fsp.writeFile(pathJson, JSON.stringify(jadibots, null, 2), "utf8");
  return true;
}

export { listJadibot, deleteJadibot, updateJadibot, getJadibot };
