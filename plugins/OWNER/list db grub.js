import fs from 'fs/promises';
import path from 'path';
import {
  salinSemuaList,
  deleteAllListInGroup,
  getDataByGroupId,
  readList,
} from '../../lib/list.js';
import { deleteCache } from '../../lib/globalCache.js';

// Lokasi file media list — sama dengan MEDIA_DIR di lib/list.js
// (`content.media` tiap keyword menyimpan NAMA FILE di folder ini).
const MEDIA_DIR = path.resolve('./database/media');

/**
 * Kelola database LIST sebuah grup lewat ID-nya — berguna ketika grup sudah
 * TERBLOKIR/di-ban sehingga bot tidak bisa menjalankan perintah di dalam grup
 * itu (tidak bisa .idclone / .resetgc di sana). Fungsi lib bekerja langsung di
 * database berdasarkan ID, jadi bot tidak perlu berada di grup tersebut.
 *
 *  .listdbgrub                                           -> tampilkan SEMUA grup yang masih punya list di database (beserta ID-nya)
 *  .copylistid <idGrupSumber>  (jalankan di grup TUJUAN) -> salin list dari grup sumber ke grup ini
 *  .copylistid <idSumber> <idTujuan>                     -> salin antar id langsung
 *  .dellistid  <idGrup>                                  -> hapus seluruh list grup itu
 *
 * Alur untuk grup terblokir: jalankan `.listdbgrub` dulu untuk menemukan ID
 * grup yang datanya masih tersimpan (tidak perlu akses ke grupnya), lalu pakai
 * ID itu di `.copylistid` / `.dellistid`.
 */
function normalisasiId(raw) {
  if (!raw) return null;
  const teks = raw.trim();
  if (/@g\.us$/i.test(teks)) return teks;
  const digit = teks.replace(/\D/g, '');
  return digit ? `${digit}@g.us` : null;
}

function jumlahKeyword(data) {
  return data && data.list && typeof data.list === 'object' ? Object.keys(data.list).length : 0;
}

/**
 * Perkiraan ukuran penyimpanan sebuah grup: teks JSON list + seluruh file
 * media yang dirujuk tiap keyword (`content.media` di folder MEDIA_DIR).
 * Media yang hilang/filenya tidak ada diabaikan.
 */
async function ukuranGrup(data) {
  let bytes = 0;
  try {
    bytes += Buffer.byteLength(JSON.stringify(data || {}), 'utf8');
  } catch {
    // data tidak bisa di-stringify (mustahil untuk data DB), abaikan saja
  }

  const list = data?.list && typeof data.list === 'object' ? data.list : {};
  for (const key of Object.keys(list)) {
    const media = list[key]?.content?.media;
    if (!media || typeof media !== 'string') continue;
    try {
      const st = await fs.stat(path.join(MEDIA_DIR, media));
      bytes += st.size;
    } catch {
      // file media sudah tidak ada -> tidak dihitung
    }
  }
  return bytes;
}

function formatUkuran(bytes) {
  if (!bytes || bytes < 1) return '0 B';
  const satuan = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(satuan.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const nilai = bytes / 1024 ** i;
  // Byte selalu bulat; satuan lain 1 desimal tapi ".0" dibuang agar rapi
  // (mis. 820 KB, bukan 820.0 KB).
  const teks = i === 0 ? String(Math.round(nilai)) : nilai.toFixed(1).replace(/\.0$/, '');
  return `${teks} ${satuan[i]}`;
}

function tanggalSingkat(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, command, prefix, isGroup } = messageInfo;
  const args = (content || '').trim().split(/\s+/).filter(Boolean);

  // ===== Daftar semua grup yang masih punya list di database =====
  // Dipakai untuk MENEMUKAN id grup yang terblokir: datanya masih ada di DB
  // walaupun bot tidak bisa lagi masuk ke grupnya.
  if (command === 'listdbgrub') {
    const semua = await readList();
    const entri = await Promise.all(
      Object.entries(semua || {})
        .map(([id, data]) => ({ id, total: jumlahKeyword(data), updatedAt: data?.updatedAt, data }))
        .filter((e) => e.total > 0)
        .map(async (e) => ({ ...e, bytes: await ukuranGrup(e.data) })),
    );

    if (entri.length === 0) {
      return sock.sendMessage(
        remoteJid,
        { text: '_📂 Tidak ada grup yang memiliki list di database._' },
        { quoted: message },
      );
    }

    // Diurutkan dari yang PALING besar supaya grup pemakan ruang mudah terlihat.
    entri.sort((a, b) => b.bytes - a.bytes);

    const totalBytes = entri.reduce((sum, e) => sum + e.bytes, 0);

    const baris = entri
      .map((e, i) => {
        // Tandai bila entri ini adalah GRUP SAAT INI (tempat perintah dijalankan).
        const tanda = isGroup && e.id === remoteJid ? '  👈 _grup saat ini_' : '';
        return `${i + 1}. \`${e.id}\`${tanda}\n   └ *${e.total}* keyword · *${formatUkuran(e.bytes)}* · _${tanggalSingkat(e.updatedAt)}_`;
      })
      .join('\n');

    const teks =
      `📂 *Grup dengan List di Database* (${entri.length})\n` +
      `💾 _Total: ${formatUkuran(totalBytes)}_\n\n${baris}\n\n` +
      `_Salin ID di atas untuk dipakai:_\n` +
      `• *${prefix}copylistid <id>* _(di grup tujuan)_\n` +
      `• *${prefix}dellistid <id>*`;

    return sock.sendMessage(remoteJid, { text: teks }, { quoted: message });
  }

  // ===== Hapus list grup berdasarkan id =====
  if (command === 'dellistid') {
    const target = normalisasiId(args[0]);
    if (!target) {
      return sock.sendMessage(
        remoteJid,
        { text: `_⚠️ Format:_ *${prefix}${command} 1203xxxx@g.us*` },
        { quoted: message },
      );
    }

    const dataSebelum = await getDataByGroupId(target);
    const sebelum = Object.keys(dataSebelum?.list || {}).length;
    const hasil = await deleteAllListInGroup(target);
    deleteCache(`list-${target}`);

    return sock.sendMessage(
      remoteJid,
      {
        text: hasil.success
          ? `✅ _List grup_ \`${target}\` _berhasil dihapus (${sebelum} keyword)._`
          : `❌ _${hasil.message}_`,
      },
      { quoted: message },
    );
  }

  // ===== Salin list dari grup (sumber) =====
  // Bentuk: ".copylistid <sumber>" di grup tujuan, atau ".copylistid <sumber> <tujuan>"
  const sumber = normalisasiId(args[0]);
  let tujuan = normalisasiId(args[1]);
  if (!tujuan && isGroup) tujuan = remoteJid;

  if (!sumber || !tujuan) {
    return sock.sendMessage(
      remoteJid,
      {
        text:
          `_⚠️ Format:_\n` +
          `_• Jalankan di grup tujuan:_ *${prefix}${command} <idGrupSumber>*\n` +
          `_• Atau antar id:_ *${prefix}${command} <idSumber> <idTujuan>*`,
      },
      { quoted: message },
    );
  }

  if (sumber === tujuan) {
    return sock.sendMessage(
      remoteJid,
      { text: '⚠️ _ID sumber dan tujuan tidak boleh sama._' },
      { quoted: message },
    );
  }

  const hasil = await salinSemuaList(sumber, tujuan, { timpa: false });
  deleteCache(`list-${tujuan}`);

  if (!hasil.success) {
    return sock.sendMessage(remoteJid, { text: `❌ _${hasil.message}_` }, { quoted: message });
  }

  return sock.sendMessage(
    remoteJid,
    {
      text:
        `✅ _List berhasil disalin._\n\n` +
        `│ Dari : \`${sumber}\`\n` +
        `│ Ke : \`${tujuan}\`\n` +
        `│ List baru masuk : *${hasil.disalin}*\n` +
        `│ Dilewati (sudah ada) : *${hasil.dilewati}*\n` +
        `│ Total di sumber : *${hasil.total}*` +
        (hasil.mediaGagal ? `\n\n_⚠️ ${hasil.mediaGagal} media gagal disalin._` : ''),
    },
    { quoted: message },
  );
}

export default {
  handle,
  Commands: ['listdbgrub', 'copylistid', 'dellistid'],
  OnlyPremium: false,
  OnlyOwner: true,
};
