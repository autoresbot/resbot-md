/**
 * .swhd - kembalikan file yang dikirim sebagai DOCUMENT menjadi media biasa
 * (video / foto / stiker / audio) tanpa kompresi WhatsApp.
 *
 * Mengirim ulang isi document apa adanya sering menghasilkan pesan yang tidak
 * bisa diunduh / diputar penerima: video iPhone (MOV + HEVC), MKV, video
 * 10-bit, foto HEIC, audio WAV/FLAC, dst. bukan format yang diterima WhatsApp
 * untuk pesan media. Karena itu file dicek dulu dengan ffmpeg dan, bila perlu,
 * dikonversi ke format WhatsApp:
 *  - video  -> MP4 H.264 + AAC (bila sudah H.264 cukup dibungkus ulang, cepat
 *              dan tanpa turun kualitas)
 *  - foto   -> JPEG/PNG apa adanya, format lain diubah ke JPEG
 *  - GIF    -> video MP4 yang diputar berulang
 *  - audio  -> MP3 / M4A / OGG-Opus apa adanya, format lain diubah ke MP3
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import FileType from 'file-type';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';

import { downloadQuotedMedia, downloadMedia, getContextInfo, extractMedia } from '../../lib/utils.js';

/** Batas waktu konversi video, supaya bot tidak "⏰" selamanya. */
const BATAS_KONVERSI_MS = 10 * 60 * 1000;
const BATAS_PROBE_MS = 30 * 1000;

/** Sisi terpanjang video hasil konversi ulang (Full HD). */
const SISI_MAKS_VIDEO = 1920;

const AUDIO_DITERIMA = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/aac', 'audio/x-m4a', 'audio/m4a'];

const tmpPath = (ext) => path.join('tmp', `swhd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`);

/* --------------------------------- ffmpeg --------------------------------- */

function jalankanFfmpeg(args, batasMs) {
  return new Promise((resolve, reject) => {
    const proses = spawn(ffmpegPath, ['-hide_banner', '-nostdin', ...args], { windowsHide: true });
    let stderr = '';
    proses.stderr.on('data', (d) => {
      stderr += d;
      if (stderr.length > 200000) stderr = stderr.slice(-100000);
    });
    const timer = setTimeout(() => {
      proses.kill('SIGKILL');
      reject(new Error(`Konversi terlalu lama (lebih dari ${Math.round(batasMs / 60000)} menit)`));
    }, batasMs);
    proses.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proses.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
  });
}

/** Info media dari keluaran `ffmpeg -i` (ffprobe tidak tersedia di bot). */
async function bacaInfoMedia(file) {
  const { stderr } = await jalankanFfmpeg(['-i', file], BATAS_PROBE_MS);

  const durasi = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  const baris = (jenis) =>
    stderr.split('\n').find((l) => /Stream #/.test(l) && l.includes(`: ${jenis}: `) && !/attached pic/.test(l));
  const video = baris('Video');
  const audio = baris('Audio');

  const ukuran = video && /, (\d{2,5})x(\d{2,5})/.exec(video);
  const rotasi = /rotation of (-?\d+(?:\.\d+)?) degrees/.exec(stderr) || /rotate\s*:\s*(-?\d+)/.exec(stderr);
  const miring = rotasi && Math.abs(Math.round(Number(rotasi[1]))) % 180 === 90;

  let width = ukuran ? Number(ukuran[1]) : undefined;
  let height = ukuran ? Number(ukuran[2]) : undefined;
  if (miring) [width, height] = [height, width]; // ukuran sesuai tampilan di layar

  return {
    seconds: durasi ? Math.round(Number(durasi[1]) * 3600 + Number(durasi[2]) * 60 + Number(durasi[3])) : undefined,
    width,
    height,
    videoCodec: video ? /: Video: (\w+)/.exec(video)?.[1] : null,
    pixFmt: video ? /\b(yuv\w+|yuvj\w+|nv12|p010\w*|rgb\w*|bgr\w*|gray\w*)\b/.exec(video)?.[1] : null,
    audioCodec: audio ? /: Audio: (\w+)/.exec(audio)?.[1] : null,
  };
}

/* ------------------------------ deteksi jenis ------------------------------ */

/**
 * Tentukan bentuk asli file. Mimetype document kerap kosong atau
 * `application/octet-stream`, jadi isi file ikut diintip (magic bytes).
 */
async function tentukanJenis(mediaType, mimeType, file) {
  let mime = (mimeType || '').toLowerCase().split(';')[0].trim();

  if (!mime || mime === 'application/octet-stream' || mediaType === 'document') {
    const terdeteksi = await FileType.fromFile(file).catch(() => null);
    if (terdeteksi?.mime) mime = terdeteksi.mime;
  }

  if (mediaType && !['document'].includes(mediaType)) return { kind: mediaType, mime };
  if (mime === 'image/gif') return { kind: 'gif', mime };
  if (mime === 'image/webp') return { kind: 'sticker', mime };
  if (mime.startsWith('video/')) return { kind: 'video', mime };
  if (mime.startsWith('image/')) return { kind: 'image', mime };
  if (mime.startsWith('audio/') || mime === 'application/ogg') return { kind: 'audio', mime };
  return { kind: null, mime };
}

/* ------------------------------- konversi ------------------------------- */

/**
 * Jadikan video yang pasti bisa diunduh & diputar di WhatsApp.
 * @returns {Promise<{file: string, info: object, dikonversi: boolean}>}
 */
async function siapkanVideo(sumber, sampah, { gif = false } = {}) {
  const info = await bacaInfoMedia(sumber);
  if (!info.videoCodec) throw new Error('File ini tidak berisi video yang bisa dibaca.');

  const keluaran = tmpPath('mp4');
  sampah.push(keluaran);

  // H.264 8-bit + AAC (atau tanpa suara) sudah sesuai: cukup dibungkus ulang
  // ke MP4 dengan index di depan (faststart) supaya bisa diputar sambil unduh.
  const sudahCocok =
    !gif &&
    info.videoCodec === 'h264' &&
    (!info.pixFmt || /^yuvj?420p$/.test(info.pixFmt)) &&
    (!info.audioCodec || info.audioCodec === 'aac');

  const args = sudahCocok
    ? ['-y', '-i', sumber, '-map', '0:v:0', '-map', '0:a:0?', '-c', 'copy', '-movflags', '+faststart', keluaran]
    : [
        '-y',
        '-i',
        sumber,
        '-map',
        '0:v:0',
        ...(gif ? ['-an'] : ['-map', '0:a:0?', '-c:a', 'aac', '-b:a', '160k', '-ac', '2']),
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '20',
        '-pix_fmt',
        'yuv420p',
        '-vf',
        `scale='min(${SISI_MAKS_VIDEO},iw)':'min(${SISI_MAKS_VIDEO},ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2`,
        '-movflags',
        '+faststart',
        keluaran,
      ];

  const { code, stderr } = await jalankanFfmpeg(args, BATAS_KONVERSI_MS);
  if (code !== 0 || !fs.existsSync(keluaran) || fs.statSync(keluaran).size === 0) {
    const alasan = stderr.trim().split('\n').slice(-2).join(' ').slice(0, 200);
    throw new Error(`Gagal mengonversi video. ${alasan}`);
  }

  return { file: keluaran, info: await bacaInfoMedia(keluaran), dikonversi: !sudahCocok };
}

async function siapkanGambar(sumber, mime, sampah) {
  if (mime === 'image/jpeg' || mime === 'image/png') return { file: sumber, mimetype: mime };

  const keluaran = tmpPath('jpg');
  sampah.push(keluaran);
  try {
    const sharp = (await import('sharp')).default;
    await sharp(sumber).rotate().jpeg({ quality: 95 }).toFile(keluaran);
  } catch {
    const { code } = await jalankanFfmpeg(['-y', '-i', sumber, '-frames:v', '1', '-q:v', '2', keluaran], BATAS_PROBE_MS);
    if (code !== 0 || !fs.existsSync(keluaran)) {
      throw new Error(`Format gambar ${mime || 'ini'} tidak bisa dikonversi. Kirim sebagai foto biasa.`);
    }
  }
  return { file: keluaran, mimetype: 'image/jpeg' };
}

async function siapkanAudio(sumber, mime, sampah) {
  const info = await bacaInfoMedia(sumber);
  if (!info.audioCodec) throw new Error('File ini tidak berisi audio yang bisa dibaca.');

  // OGG berisi Opus = voice note; MP3/M4A/AAC diterima sebagai audio biasa.
  if (/ogg/.test(mime) && info.audioCodec === 'opus') {
    return { file: sumber, mimetype: 'audio/ogg; codecs=opus', ptt: true };
  }
  if (AUDIO_DITERIMA.includes(mime)) return { file: sumber, mimetype: mime, ptt: false };

  const keluaran = tmpPath('mp3');
  sampah.push(keluaran);
  const { code } = await jalankanFfmpeg(
    ['-y', '-i', sumber, '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', keluaran],
    BATAS_KONVERSI_MS,
  );
  if (code !== 0 || !fs.existsSync(keluaran)) throw new Error('Gagal mengonversi audio.');
  return { file: keluaran, mimetype: 'audio/mpeg', ptt: false };
}

/* --------------------------------- handle --------------------------------- */

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;
  const sampah = [];

  const balas = (text) => sock.sendMessage(remoteJid, { text }, { quoted: message });
  const reaksi = (text) => sock.sendMessage(remoteJid, { react: { text, key: message.key } }).catch(() => {});

  try {
    /**
     * SUMBER MEDIA
     *
     * Media yang dikirim bersama caption .swhd diutamakan, lalu media yang
     * di-reply. Reply dibaca dari contextInfo pesan apa pun (bukan hanya pesan
     * teks), jadi tetap jalan walau reply-nya berupa gambar/document ber-caption.
     */
    const dariRantai = Boolean(message?.__mediaRantai);
    const mediaLangsung = extractMedia(message);
    const mediaDikutip = extractMedia(getContextInfo(message)?.quotedMessage);
    const info = dariRantai ? null : mediaLangsung || mediaDikutip;

    if (!dariRantai && !info) {
      return await balas(
        `⚠️ *Format Salah*\n\n` +
          `Reply document (video/foto/audio) dengan:\n*${prefix}${command} [caption]*\n\n` +
          `Atau kirim document dengan caption *${prefix}${command}*`,
      );
    }

    await reaksi('⏰');

    const mediaFile =
      dariRantai || mediaLangsung ? await downloadMedia(message) : await downloadQuotedMedia(message);

    if (!mediaFile) {
      throw new Error(
        'Gagal mengunduh file dari WhatsApp. File mungkin sudah terlalu lama / terhapus, ' +
          'kirim ulang document-nya lalu coba lagi.',
      );
    }

    const mediaPath = path.join('tmp', mediaFile);
    sampah.push(mediaPath);
    if (!fs.existsSync(mediaPath)) throw new Error('File hasil unduhan tidak ditemukan.');

    const { kind, mime } = await tentukanJenis(info?.mediaType, info?.mediaMessage?.mimetype, mediaPath);
    const caption = content || '';

    if (kind === 'video' || kind === 'gif') {
      const gif = kind === 'gif' || Boolean(info?.mediaMessage?.gifPlayback);
      const video = await siapkanVideo(mediaPath, sampah, { gif });
      await sock.sendMessage(
        remoteJid,
        {
          video: { url: video.file },
          caption,
          mimetype: 'video/mp4',
          ...(gif ? { gifPlayback: true } : {}),
          ...(video.info.seconds !== undefined ? { seconds: video.info.seconds } : {}),
          ...(video.info.width ? { width: video.info.width, height: video.info.height } : {}),
        },
        { quoted: message },
      );
    } else if (kind === 'image') {
      const gambar = await siapkanGambar(mediaPath, mime, sampah);
      await sock.sendMessage(
        remoteJid,
        { image: { url: gambar.file }, caption, mimetype: gambar.mimetype },
        { quoted: message },
      );
    } else if (kind === 'sticker') {
      await sock.sendMessage(remoteJid, { sticker: fs.readFileSync(mediaPath) }, { quoted: message });
    } else if (kind === 'audio') {
      // Audio tidak mendukung caption.
      const audio = await siapkanAudio(mediaPath, mime, sampah);
      await sock.sendMessage(
        remoteJid,
        { audio: { url: audio.file }, mimetype: audio.mimetype, ptt: audio.ptt },
        { quoted: message },
      );
    } else {
      throw new Error(`Tipe file tidak didukung: ${mime || 'tidak diketahui'}. Hanya video, foto, GIF, dan audio.`);
    }

    await reaksi('✅');
  } catch (err) {
    console.error('[SWHD ERROR]', err);
    await reaksi('❌');
    await balas(`❌ Gagal convert document\n\n${err.message}`);
  } finally {
    // Bersihkan file sementara, termasuk saat konversi gagal di tengah jalan
    for (const file of sampah) fs.unlink(file, () => {});
  }
}

export default {
  handle,
  Commands: ['swhd'],
  OnlyOwner: false,
  OnlyPremium: false,
};
