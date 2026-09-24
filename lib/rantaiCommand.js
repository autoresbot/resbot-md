/**
 * rantaiCommand.js - Menjalankan beberapa command sekaligus dalam satu pesan.
 *
 * Contoh: `.removebg + sticker`
 *   1. .removebg jalan seperti biasa, TAPI hasil gambarnya dicegat (tidak
 *      dikirim ke chat),
 *   2. hasil itu dipakai sebagai gambar masukan untuk .sticker,
 *   3. hanya hasil langkah TERAKHIR yang benar-benar dikirim ke user.
 *
 * Cara kerjanya bertumpu pada dua sifat arsitektur plugin di project ini:
 *
 *  1. SEMUA plugin mengirim hasil lewat `sock.sendMessage` dan menerima `sock`
 *     sebagai parameter (tidak ada satu pun yang memanggil socket global).
 *     Jadi cukup mengoper "sock bayangan" untuk langkah yang belum terakhir,
 *     dan kirimannya tertangkap di sini.
 *  2. SEMUA plugin mengambil media lewat downloadMedia/downloadQuotedMedia,
 *     dan keduanya mengembalikan NAMA FILE di folder tmp/. Jadi hasil langkah
 *     sebelumnya cukup ditulis ke tmp/, lalu kedua fungsi itu disuruh
 *     mengembalikan nama file tersebut (lihat penanda `__mediaRantai` di
 *     lib/utils.js). Plugin langkah berikutnya tidak perlu diubah sama sekali.
 */

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

import { logWithTime, downloadToBuffer } from './utils.js';

/** Pemisah rantai WAJIB pakai spasi kiri-kanan, supaya `1+1` tidak ikut terpecah. */
const PEMISAH = /\s+\+\s+/;

/** Rantai panjang menghabiskan waktu & kuota API; 3 langkah sudah lebih dari cukup. */
const MAKS_LANGKAH = 3;

const FOLDER_TMP = 'tmp';

/**
 * Command yang boleh dirantai.
 *
 * - `terima` : jenis media yang bisa diproses command ini
 * - `hasil`  : jenis media yang dihasilkannya (dipakai sebagai masukan langkah
 *              berikutnya). `null` = hanya boleh jadi langkah terakhir.
 *
 * Daftar ini SENGAJA dibatasi: yang boleh masuk hanyalah command yang
 * menghasilkan TEPAT SATU media. Command seperti .play mengirim dua media
 * (thumbnail lalu audio), jadi tidak jelas mana yang harus diteruskan.
 */
const RANTAI = {
  // --- TOOLS ---
  rmbg: { terima: ['image'], hasil: 'image' },
  removebg: { terima: ['image'], hasil: 'image' },
  nobg: { terima: ['image'], hasil: 'image' },
  hd: { terima: ['image'], hasil: 'image' },
  remini: { terima: ['image'], hasil: 'image' },
  toimg: { terima: ['sticker'], hasil: 'image' },

  // --- EDITOR ---
  blur: { terima: ['image'], hasil: 'image' },
  duotone: { terima: ['image'], hasil: 'image' },
  flipx: { terima: ['image'], hasil: 'image' },
  flipy: { terima: ['image'], hasil: 'image' },
  grayscale: { terima: ['image'], hasil: 'image' },
  resize: { terima: ['image'], hasil: 'image' },
  rotate: { terima: ['image'], hasil: 'image' },
  sepia: { terima: ['image'], hasil: 'image' },
  tajam: { terima: ['image'], hasil: 'image' },
  wanted: { terima: ['image'], hasil: 'image' },
  wasted: { terima: ['image'], hasil: 'image' },

  // --- MAKER ---
  sticker: { terima: ['image', 'video'], hasil: 'sticker' },
  stiker: { terima: ['image', 'video'], hasil: 'sticker' },
  s: { terima: ['image', 'video'], hasil: 'sticker' },
  stickercircle: { terima: ['image'], hasil: 'sticker' },
  scircle: { terima: ['image'], hasil: 'sticker' },
  smeme: { terima: ['image'], hasil: 'sticker' },
  tovid: { terima: ['image', 'sticker'], hasil: 'video' },
  togif: { terima: ['image', 'sticker'], hasil: 'video' },
};

const NAMA_JENIS = { image: 'gambar', video: 'video', sticker: 'stiker' };

function aturanRantai(command) {
  return RANTAI[String(command || '').toLowerCase()] || null;
}

/** Apakah command ini dikenal plugin mana pun? Dipakai untuk pesan error yang tepat. */
function commandTerdaftar(plugins, command) {
  const cmd = String(command || '').toLowerCase();
  return plugins.some((p) => Array.isArray(p?.Commands) && p.Commands.includes(cmd));
}

function cariPlugin(plugins, command) {
  const cmd = String(command || '').toLowerCase();
  return plugins.find((p) => Array.isArray(p?.Commands) && p.Commands.includes(cmd)) || null;
}

/**
 * Pecah pesan jadi daftar langkah.
 *
 * @returns {null} bukan rantai - proses seperti biasa
 * @returns {{ galat: string }} bentuknya rantai tapi tidak bisa dijalankan
 * @returns {{ langkah: Array }} siap dijalankan
 */
function pecahRantai(messageInfo, plugins = []) {
  const { command, content, prefix } = messageInfo;
  if (!prefix || !command) return null;

  const teks = `${command} ${content || ''}`.trim();
  if (!PEMISAH.test(teks)) return null;

  const bagian = teks
    .split(PEMISAH)
    .map((b) => b.trim())
    .filter(Boolean);

  if (bagian.length < 2) return null;

  const langkah = [];

  for (const potongan of bagian) {
    const [cmd, ...sisa] = potongan.split(/\s+/);
    const aturan = aturanRantai(cmd);

    if (!aturan) {
      // Kalau command-nya memang tidak dikenal, ini bukan rantai - mungkin
      // cuma teks yang kebetulan memuat " + " (mis. `.kalkulator 1 + 1`).
      // Biarkan diproses seperti biasa.
      if (!commandTerdaftar(plugins, cmd)) return null;

      return {
        galat: `⛔ _Command *${prefix}${cmd}* belum bisa dipakai dalam rantai._\n\n_Ketik *${prefix}rantai* untuk melihat daftar command yang bisa._`,
      };
    }

    langkah.push({
      command: String(cmd).toLowerCase(),
      args: sisa.join(' '),
      aturan,
    });
  }

  if (langkah.length > MAKS_LANGKAH) {
    return { galat: `⛔ _Rantai maksimal ${MAKS_LANGKAH} command._` };
  }

  // Pastikan hasil tiap langkah bisa diterima langkah sesudahnya, supaya
  // kegagalannya ketahuan SEKARANG - bukan setelah user menunggu 1 menit.
  for (let i = 0; i < langkah.length - 1; i++) {
    const sekarang = langkah[i];
    const berikut = langkah[i + 1];

    if (!sekarang.aturan.hasil) {
      return {
        galat: `⛔ _*${prefix}${sekarang.command}* hanya bisa jadi langkah terakhir._`,
      };
    }

    if (!berikut.aturan.terima.includes(sekarang.aturan.hasil)) {
      const dapat = NAMA_JENIS[sekarang.aturan.hasil] || sekarang.aturan.hasil;
      const butuh = berikut.aturan.terima.map((t) => NAMA_JENIS[t] || t).join('/');
      return {
        galat: `⛔ _*${prefix}${sekarang.command}* menghasilkan ${dapat}, tapi *${prefix}${berikut.command}* butuh ${butuh}._`,
      };
    }
  }

  return { langkah };
}

/* ======================= SOCK BAYANGAN ======================= */

/** Tebak ekstensi dari ISI file, bukan dari namanya - sumbernya macam-macam. */
function ekstensiDariBuffer(buffer) {
  if (!buffer || buffer.length < 12) return '.bin';
  const awal = buffer.subarray(0, 12);

  if (awal[0] === 0xff && awal[1] === 0xd8) return '.jpg';
  if (awal[0] === 0x89 && awal[1] === 0x50) return '.png';
  if (awal.subarray(0, 3).toString('ascii') === 'GIF') return '.gif';
  if (
    awal.subarray(0, 4).toString('ascii') === 'RIFF' &&
    awal.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return '.webp';
  }
  if (awal.subarray(4, 8).toString('ascii') === 'ftyp') return '.mp4';

  return '.bin';
}

/**
 * Ambil isi media dari payload sendMessage.
 *
 * WAJIB dibaca SEKARANG JUGA, bukan disimpan lalu dibaca belakangan:
 * lib/exif.js mengirim stiker sebagai `{ url: <path lokal> }` lalu MENGHAPUS
 * file itu di blok `finally` persis setelah sendMessage selesai.
 */
async function bacaMediaPayload(isi) {
  for (const jenis of ['image', 'video', 'sticker', 'audio', 'document']) {
    const nilai = isi?.[jenis];
    if (!nilai) continue;

    if (Buffer.isBuffer(nilai)) return { jenis, buffer: nilai };

    const sumber = typeof nilai === 'string' ? nilai : nilai?.url;
    if (typeof sumber !== 'string' || !sumber) continue;

    try {
      if (/^https?:\/\//i.test(sumber)) {
        return { jenis, buffer: await downloadToBuffer(sumber, 'bin') };
      }
      if (fs.existsSync(sumber)) {
        return { jenis, buffer: await fsp.readFile(sumber) };
      }
    } catch (error) {
      logWithTime('RANTAI', `Gagal membaca media hasil: ${error?.message || error}`);
    }
  }

  return null;
}

/**
 * Bungkus sock supaya kiriman langkah non-terakhir tertangkap, bukan terkirim.
 *
 * Object.create dipakai (bukan menyalin properti) supaya SEMUA method lain
 * milik sock tetap tersedia apa adanya - hanya sendMessage yang ditimpa.
 */
function buatSockBayangan(sock) {
  const tertangkap = [];
  const teksTertahan = [];

  const bayangan = Object.create(sock);

  bayangan.sendMessage = async (jid, isi, opsi) => {
    // Reaksi (⏰/❗) tetap diteruskan: itu indikator progres buat user.
    if (isi?.react) return sock.sendMessage(jid, isi, opsi);

    const media = await bacaMediaPayload(isi);
    if (media) {
      tertangkap.push(media);
      return { key: { id: `RANTAI_${tertangkap.length}` } };
    }

    // Teks ditahan dulu. Biasanya ini pesan validasi/error plugin ("kirim
    // gambar dulu", "terjadi kesalahan"). Kalau langkah ini ternyata tidak
    // menghasilkan media, teks inilah yang diteruskan ke user sebagai alasan.
    if (typeof isi?.text === 'string') teksTertahan.push(isi.text);
    return { key: { id: 'RANTAI_TEKS' } };
  };

  return { bayangan, tertangkap, teksTertahan };
}

/* ======================= PELAKSANA ======================= */

/**
 * Jalankan seluruh langkah.
 *
 * @param {object} opsi.cekIzin async (plugin, infoLangkah) => boolean
 *        Pengecekan OnlyOwner/OnlyPremium/limit milik autoresbot.js, dipanggil
 *        ULANG untuk setiap langkah supaya rantai tidak jadi celah
 *        "2 fitur, potong 1 limit".
 */
async function jalankanRantai(sock, messageInfo, langkah, { plugins, cekIzin }) {
  const { remoteJid, message, prefix } = messageInfo;

  const kirimTeks = (text) => sock.sendMessage(remoteJid, { text }, { quoted: message });

  const berkasSementara = [];
  const penandaAsli = Object.prototype.hasOwnProperty.call(message, '__mediaRantai')
    ? message.__mediaRantai
    : undefined;

  try {
    let infoLangkah = { ...messageInfo };

    for (let i = 0; i < langkah.length; i++) {
      const { command, args, aturan } = langkah[i];
      const terakhir = i === langkah.length - 1;

      const plugin = cariPlugin(plugins, command);
      if (!plugin || typeof plugin.handle !== 'function') {
        await kirimTeks(`⛔ _Command *${prefix}${command}* tidak ditemukan._`);
        return;
      }

      infoLangkah = {
        ...infoLangkah,
        command,
        content: args,
        fullText: `${prefix}${command}${args ? ` ${args}` : ''}`,
      };

      if (!(await cekIzin(plugin, infoLangkah))) return;

      logWithTime(
        'RANTAI',
        `Langkah ${i + 1}/${langkah.length}: ${prefix}${command} (${terakhir ? 'dikirim' : 'ditangkap'})`,
      );

      // Langkah terakhir memakai sock asli supaya hasilnya benar-benar dikirim.
      const { bayangan, tertangkap, teksTertahan } = buatSockBayangan(sock);
      const sockDipakai = terakhir ? sock : bayangan;

      await plugin.handle(sockDipakai, infoLangkah);

      if (terakhir) return;

      // Hasil terakhir yang dipakai: sebagian plugin mengirim pratinjau dulu
      // sebelum file aslinya.
      const hasil = tertangkap[tertangkap.length - 1];

      if (!hasil) {
        // Plugin di project ini TIDAK PERNAH melempar error - semuanya
        // ditangkap sendiri lalu dikirim sebagai teks. Jadi kegagalan langkah
        // hanya bisa dikenali dari "tidak ada media yang tertangkap".
        const alasan = teksTertahan.filter(Boolean).join('\n\n');
        await kirimTeks(
          `⛔ _Rantai berhenti di langkah ${i + 1}: *${prefix}${command}*_` +
            (alasan ? `\n\n${alasan}` : '\n\n_Langkah ini tidak menghasilkan media._'),
        );
        return;
      }

      // Tulis hasil ke tmp/ lalu pasang penandanya. downloadMedia() &
      // downloadQuotedMedia() akan mengembalikan nama file ini apa adanya,
      // jadi plugin langkah berikutnya berjalan tanpa tahu ada rantai.
      const namaFile = `rantai_${Date.now()}_${i}${ekstensiDariBuffer(hasil.buffer)}`;
      await fsp.writeFile(path.join(FOLDER_TMP, namaFile), hasil.buffer);
      berkasSementara.push(path.join(FOLDER_TMP, namaFile));

      // Penanda dipasang di objek message ASLI (bukan salinan) supaya
      // `{ quoted: message }` di dalam plugin tetap memakai objek yang sama
      // persis seperti biasa. Dibersihkan lagi di blok finally.
      message.__mediaRantai = namaFile;

      infoLangkah = {
        ...infoLangkah,
        type: aturan.hasil,
        isQuoted: false,
        message,
      };
    }
  } catch (error) {
    logWithTime('RANTAI', `Gagal: ${error?.message || error}`);
    await kirimTeks(
      `⚠️ _Rantai command gagal diproses._\n\n◧ _Penyebab: ${error?.message || error}_`,
    ).catch(() => {});
  } finally {
    if (penandaAsli === undefined) delete message.__mediaRantai;
    else message.__mediaRantai = penandaAsli;

    for (const berkas of berkasSementara) {
      fsp.unlink(berkas).catch(() => {});
    }
  }
}

/** Daftar command yang bisa dirantai, dikelompokkan untuk ditampilkan ke user. */
function daftarRantai() {
  const kelompok = new Map();

  for (const [cmd, aturan] of Object.entries(RANTAI)) {
    const kunci = `${aturan.terima.join(',')}>${aturan.hasil}`;
    if (!kelompok.has(kunci)) kelompok.set(kunci, { aturan, commands: [] });
    kelompok.get(kunci).commands.push(cmd);
  }

  return [...kelompok.values()];
}

export { pecahRantai, jalankanRantai, daftarRantai, aturanRantai, MAKS_LANGKAH, RANTAI };
