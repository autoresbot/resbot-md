/**
 * list.js - Manajemen List/Keyword per Group menggunakan SQLite
 * 
 * Refactored dari JSON file ke SQLite.
 * Semua fungsi export tetap sama agar backward compatible.
 */

import fs from 'fs/promises';
import path from 'path';
import { getDb, safeJsonParse, toJson, initDatabase } from './database.js';
import { cleanText } from './utils.js';

initDatabase();

let stmtCache = {};

function getStmt(key, sql) {
  if (!stmtCache[key]) {
    stmtCache[key] = getDb().prepare(sql);
  }
  return stmtCache[key];
}

/**
 * Helper: get group data dari SQLite
 */
function getGroupData(id) {
  const row = getStmt('getById', 'SELECT * FROM list WHERE id = ?').get(id);
  if (!row) return null;
  return safeJsonParse(row.data, null);
}

/**
 * Helper: save group data ke SQLite
 */
function saveGroupData(id, data) {
  const existing = getStmt('getById', 'SELECT id FROM list WHERE id = ?').get(id);
  if (existing) {
    getStmt('updateList', 'UPDATE list SET data = ?, updated_at = ? WHERE id = ?')
      .run(toJson(data), new Date().toISOString(), id);
  } else {
    getStmt('insertList', 'INSERT INTO list (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(id, toJson(data), new Date().toISOString(), new Date().toISOString());
  }
}

/**
 * Membaca semua data list
 */
async function readList() {
  try {
    const rows = getStmt('readAll', 'SELECT * FROM list').all();
    const result = {};
    for (const row of rows) {
      result[row.id] = safeJsonParse(row.data, {});
    }
    return result;
  } catch (error) {
    console.error('Error reading list:', error);
    throw error;
  }
}

/**
 * Ambil data berdasarkan Group ID
 */
async function getDataByGroupId(groupId) {
  try {
    const data = getGroupData(groupId);
    return data || null;
  } catch (error) {
    console.error('Error membaca data grup:', error);
    throw error;
  }
}

/**
 * Menambahkan keyword baru
 */
async function addList(id_grub, keyword, content) {
  try {
    let groupData = getGroupData(id_grub);

    if (!groupData) {
      groupData = {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        list: {},
      };
    }

    // Validasi apakah keyword sudah ada
    if (groupData.list && groupData.list[keyword]) {
      return {
        success: false,
        message: `Keyword "${keyword}" already exists.`,
      };
    }

    if (content && content.text) {
      content.text = cleanText(content.text);
    }

    if (!groupData.list) groupData.list = {};
    groupData.list[keyword] = {
      content,
      addedAt: new Date().toISOString(),
    };
    groupData.updatedAt = new Date().toISOString();

    saveGroupData(id_grub, groupData);
    return { success: true, message: 'Keyword added successfully.' };
  } catch (error) {
    console.error('Error adding to list:', error);
    return { success: false, message: 'Error adding to list.' };
  }
}

/**
 * Update keyword yang sudah ada
 */
async function updateList(id_grub, keyword, content) {
  try {
    let groupData = getGroupData(id_grub);

    if (!groupData) {
      groupData = {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        list: {},
      };
    }

    if (!groupData.list || !groupData.list[keyword]) {
      return {
        success: false,
        message: `Keyword "${keyword}" tidak ditemukan!`,
      };
    }

    groupData.list[keyword] = {
      content,
      updatedAt: new Date().toISOString(),
    };
    groupData.updatedAt = new Date().toISOString();

    saveGroupData(id_grub, groupData);
    return {
      success: true,
      message: `Keyword "${keyword}" processed successfully.`,
    };
  } catch (error) {
    console.error('Error updating list:', error);
    return { success: false, message: 'Error updating list.' };
  }
}

/**
 * Update nama keyword
 */
async function updateKeyword(id_grub, oldKeyword, newKeyword) {
  try {
    const groupData = getGroupData(id_grub);

    if (!groupData) {
      return {
        success: false,
        message: `Group with ID "${id_grub}" does not exist.`,
      };
    }

    if (!groupData.list || !groupData.list[oldKeyword]) {
      return {
        success: false,
        message: `Keyword "${oldKeyword}" tidak ditemukan`,
      };
    }

    if (groupData.list[newKeyword]) {
      return {
        success: false,
        message: `Keyword "${newKeyword}" sudah digunakan.`,
      };
    }

    groupData.list[newKeyword] = {
      ...groupData.list[oldKeyword],
      updatedAt: new Date().toISOString(),
    };
    delete groupData.list[oldKeyword];
    groupData.updatedAt = new Date().toISOString();

    saveGroupData(id_grub, groupData);
    return { success: true, message: 'Keyword berhasil di perbarui' };
  } catch (error) {
    return { success: false, message: 'Error memperbarui keyword' };
  }
}

/**
 * Hapus keyword
 */
async function deleteList(id_grub, keyword) {
  try {
    const groupData = getGroupData(id_grub);

    if (!groupData) {
      return { success: false, message: `Group "${id_grub}" does not exist.` };
    }

    if (!groupData.list || !groupData.list[keyword]) {
      return {
        success: false,
        message: `Keyword "${keyword}" does not exist in group "${id_grub}".`,
      };
    }

    // Hapus file media jika ada
    const media = groupData.list[keyword]?.content?.media;
    if (media) {
      const filePath = `./database/media/${media}`;
      try {
        await fs.unlink(filePath);
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.log(`File ${media} tidak ditemukan.`);
        } else {
          console.error(`Gagal menghapus file ${media}:`, error);
        }
      }
    }

    delete groupData.list[keyword];
    groupData.updatedAt = new Date().toISOString();

    saveGroupData(id_grub, groupData);
    return {
      success: true,
      message: `Keyword "${keyword}" deleted successfully.`,
    };
  } catch (error) {
    console.error('Error deleting from list:', error);
    return { success: false, message: 'Error deleting from list.' };
  }
}

/**
 * Hapus semua keyword di group
 */
async function deleteAllListInGroup(id_grub) {
  try {
    const groupData = getGroupData(id_grub);

    if (!groupData) {
      return { success: false, message: `Group "${id_grub}" does not exist.` };
    }

    const list = groupData.list || {};
    const mediaDir = './database/media/';

    // Hapus file media
    for (const keyword in list) {
      const media = list[keyword]?.content?.media;
      if (media) {
        const filePath = path.join(mediaDir, media);
        try {
          await fs.unlink(filePath);
          console.log(`File media "${media}" berhasil dihapus.`);
        } catch (error) {
          if (error.code !== 'ENOENT') {
            console.error(`Gagal menghapus file media "${media}":`, error);
          } else {
            console.log(`File "${media}" tidak ditemukan.`);
          }
        }
      }
    }

    groupData.list = {};
    groupData.updatedAt = new Date().toISOString();

    saveGroupData(id_grub, groupData);

    return {
      success: true,
      message: `Semua keyword dalam group "${id_grub}" berhasil dihapus.`,
    };
  } catch (error) {
    console.error('Error deleting all list in group:', error);
    return { success: false, message: 'Gagal menghapus semua keyword.' };
  }
}

export {
  readList,
  addList,
  getDataByGroupId,
  deleteList,
  updateKeyword,
  updateList,
  deleteAllListInGroup,
  salinSemuaList,
};

/**
 * Folder tempat media list disimpan (lihat downloadMedia di lib/utils.js).
 * `content.media` berisi NAMA FILE di folder ini, bukan URL.
 */
const MEDIA_DIR = path.resolve('./database/media');

/**
 * Gandakan file media milik sebuah keyword.
 *
 * Grup tujuan tidak boleh memakai nama file yang sama dengan grup sumber:
 * deleteList() menghapus file fisiknya, jadi sekali list di grup sumber
 * dihapus, list hasil clone ikut kehilangan gambarnya.
 *
 * @returns {Promise<string|null>} nama file baru, atau null bila file asal hilang
 */
async function salinFileMedia(namaFile) {
  const asal = path.join(MEDIA_DIR, namaFile);

  try {
    await fs.access(asal);
  } catch {
    return null;
  }

  const ext = path.extname(namaFile);
  const baru = `clone_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
  await fs.copyFile(asal, path.join(MEDIA_DIR, baru));
  return baru;
}

/**
 * Salin seluruh keyword list dari satu grup ke grup lain (fitur .clonegc).
 *
 * @param {string} sumberId  id grup asal
 * @param {string} tujuanId  id grup tujuan
 * @param {{timpa?: boolean}} opsi timpa=true menimpa keyword yang sudah ada;
 *   default-nya keyword yang sudah ada dilewati supaya list grup tujuan aman.
 */
async function salinSemuaList(sumberId, tujuanId, { timpa = false } = {}) {
  try {
    const listSumber = getGroupData(sumberId)?.list || {};
    const keywords = Object.keys(listSumber);

    if (!keywords.length) {
      return { success: false, message: 'Grup sumber belum memiliki list.' };
    }

    const sekarang = new Date().toISOString();
    const tujuan = getGroupData(tujuanId) || {
      createdAt: sekarang,
      updatedAt: sekarang,
      list: {},
    };
    if (!tujuan.list) tujuan.list = {};

    let disalin = 0;
    let dilewati = 0;
    let mediaGagal = 0;

    for (const keyword of keywords) {
      if (tujuan.list[keyword] && !timpa) {
        dilewati++;
        continue;
      }

      const contentAsal = listSumber[keyword]?.content || {};
      let media = null;

      if (contentAsal.media) {
        media = await salinFileMedia(contentAsal.media);
        if (!media) mediaGagal++;
      }

      // Entri lama ditimpa -> file media lamanya tidak dipakai siapa pun lagi.
      const mediaLama = tujuan.list[keyword]?.content?.media;

      tujuan.list[keyword] = {
        content: { ...contentAsal, media },
        addedAt: sekarang,
      };
      disalin++;

      if (mediaLama && mediaLama !== media) {
        try {
          await fs.unlink(path.join(MEDIA_DIR, mediaLama));
        } catch (error) {
          if (error.code !== 'ENOENT') {
            console.error(`Gagal menghapus media lama "${mediaLama}":`, error);
          }
        }
      }
    }

    tujuan.updatedAt = sekarang;
    saveGroupData(tujuanId, tujuan);

    return { success: true, disalin, dilewati, mediaGagal, total: keywords.length };
  } catch (error) {
    console.error('Error menyalin list antar grup:', error);
    return { success: false, message: 'Terjadi kesalahan saat menyalin list.' };
  }
}
