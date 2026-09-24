// console.dir(message?.message, { depth: null });
// console.log('=============================');

import config from '../config.js';
import { isQuotedMessage, getMessageType, getSenderType } from './utils.js';
import { logLine } from './errorLogger.js';
import chalk from 'chalk';
import { jejakAktif } from './trace.js';
import { getContentType } from 'zapo-js';

/* =========================
 * CONTENT UTILS
 * ========================= */
/**
 * Ambil isi pesan setelah command/prefix, TANPA merusak newline (multi-baris).
 * Berbeda dengan normalisasi command, fungsi ini hanya membuang token command
 * pertama + whitespace pemisah di awal/akhir, sementara newline di tengah teks
 * tetap dipertahankan sesuai format asli yang diketik user.
 */
function stripCommandToken(raw, prefixWithSpace) {
  let rest = (raw || '').replace(/^\s+/, ''); // buang spasi/enter di awal saja
  if (prefixWithSpace) {
    // bentuk ". on isi" -> buang prefix lalu whitespace pemisah
    rest = rest.slice(prefixWithSpace.length).replace(/^\s+/, '');
  }
  // buang satu token command pertama (hingga whitespace pertama)
  rest = rest.replace(/^\S+/, '');
  // buang whitespace pemisah di awal & trailing, newline di tengah tetap terjaga
  return rest.trim();
}

/**
 * Buka pembungkus pesan (ephemeral / view once / document with caption) supaya
 * contextInfo yang asli ikut terbaca. Tanpa ini, pesan terusan yang dikirim di
 * grup ber-pesan-sementara lolos karena contextInfo-nya ada satu level lebih
 * dalam.
 */
function unwrapMessage(msg) {
  let inner = msg;
  for (let i = 0; i < 5 && inner; i++) {
    const wrapper =
      inner.ephemeralMessage ||
      inner.viewOnceMessage ||
      inner.viewOnceMessageV2 ||
      inner.viewOnceMessageV2Extension ||
      inner.documentWithCaptionMessage ||
      inner.editedMessage;
    if (!wrapper?.message) break;
    inner = wrapper.message;
  }
  return inner;
}

/**
 * Deteksi pesan terusan. Flag `isForwarded` saja tidak cukup:
 * - kiriman dari SALURAN (newsletter) hanya membawa
 *   `forwardedNewsletterMessageInfo`, tanpa `isForwarded`
 * - sebagian kiriman hanya membawa `forwardingScore`
 * - pesan bisa terbungkus ephemeral / view once (lihat unwrapMessage)
 */
function detectForwarded(msg) {
  const inner = unwrapMessage(msg);
  if (!inner) return false;

  const type = getContentType(inner);
  const contexts = [inner?.[type]?.contextInfo, inner?.contextInfo].filter(Boolean);

  return contexts.some(
    (ctx) =>
      ctx.isForwarded === true ||
      Number(ctx.forwardingScore) > 0 ||
      Boolean(ctx.forwardedNewsletterMessageInfo),
  );
}

/* =========================
 * DIAGNOSTIK PESAN DILEWATI
 * ========================= */
/**
 * Batas umur pesan yang masih diproses.
 *
 * Dulu batasnya 60 detik DAN dipakai dua arah (`Math.abs`), sehingga:
 *  - pesan hasil kirim-ulang WhatsApp (dekripsi gagal di percobaan pertama -
 *    sering terjadi saat seseorang PERTAMA KALI chat di grup) datang membawa
 *    timestamp aslinya, sudah lewat 60 detik, lalu DIBUANG. Gejalanya persis
 *    "command pertama & kedua tidak direspons, baru yang ke sekian masuk".
 *  - jam server yang meleset sedikit saja membuat SEMUA pesan terbuang, tanpa
 *    satu pun log yang bisa dilacak.
 *
 * Sekarang pesan lama tetap ditolak (supaya bot tidak membalas antrean lama
 * saat baru nyala), tapi batasnya jauh lebih longgar, selisih jam tidak lagi
 * ikut membuang pesan, dan setiap penolakan dicatat beserta alasannya.
 */
const MAKS_UMUR_PESAN_DETIK = 10 * 60; // 10 menit
/** Pesan "dari masa depan" hanya mungkin karena selisih jam - beri toleransi. */
const TOLERANSI_JAM_DEPAN_DETIK = 5 * 60;

/** Peringatan selisih jam cukup sekali tiap 10 menit supaya console tidak banjir. */
let logSkewTerakhir = 0;
const JEDA_LOG_SKEW = 10 * 60 * 1000;

/**
 * Catat pesan yang sengaja TIDAK diproses, ke console dan ke
 * logs/pesan-dilewati.log. Tanpa ini setiap `return null` di bawah membuang
 * pesan tanpa jejak, dan satu-satunya gejala yang terlihat user adalah
 * "bot tidak merespons".
 */
function catatPesan(label, alasan, detail = {}) {
  const info = Object.entries(detail)
    .map(([k, v]) => `${k}: ${v ?? '-'}`)
    .join(' | ');
  const baris = `${label} ${alasan}${info ? ` | ${info}` : ''}`;

  // Console hanya di mode development, supaya production tetap rapi. Filenya
  // TETAP ditulis di mode apa pun - isinya cuma pesan yang dibuang (jarang),
  // dan justru itu yang dibutuhkan saat melacak "chat tidak masuk".
  if (jejakAktif()) console.log(chalk.yellow(baris));
  try {
    logLine('pesan-dilewati.log', baris);
  } catch {
    // logging tidak boleh ikut menjatuhkan pemrosesan pesan
  }
}

/** Pesan yang benar-benar TIDAK diproses. */
function lewatiPesan(alasan, detail = {}) {
  catatPesan('[PESAN DILEWATI]', alasan, detail);
}

/**
 * Baca messageTimestamp dalam bentuk apa pun.
 *
 * zapo/protobuf bisa mengirimkannya sebagai number, string, BigInt, objek Long
 * ({ low, high }) atau Date. `Number(objekLong)` menghasilkan NaN - dan versi
 * lama langsung membuang pesannya begitu itu terjadi.
 *
 * @returns {number|null} detik unix, atau null kalau benar-benar tidak terbaca
 */
function bacaTimestamp(raw) {
  if (raw == null) return null;
  if (raw instanceof Date) return Math.floor(raw.getTime() / 1000);
  if (typeof raw === 'bigint') return Number(raw);

  if (typeof raw === 'object') {
    if (typeof raw.toNumber === 'function') {
      const n = Number(raw.toNumber());
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    if (typeof raw.low === 'number') {
      // Long 64-bit -> number. Timestamp unix selalu positif, jadi `low` cukup
      // dibaca sebagai unsigned lalu ditambah bagian `high`.
      const n = (raw.high || 0) * 4294967296 + (raw.low >>> 0);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    return null;
  }

  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* =========================
 * SERIALIZER (ASLI)
 * ========================= */
function serializeMessage(m, sock) {
  try {
    if (!m || !m.messages || !m.messages[0]) return null;
    // 'append' = sinkronisasi riwayat, bukan pesan baru. Normal, tidak dicatat.
    if (m.type === 'append') return null;

    const message = m.messages[0];
    const key = message.key || {};
    const jejak = { id: key.id || '-', chat: key.remoteJid || '-', tipe: m?.type || '-' };

    const timestamp = bacaTimestamp(message.messageTimestamp);
    const now = Math.floor(Date.now() / 1000);

    if (timestamp === null) {
      // Dulu pesan yang timestamp-nya tidak terbaca langsung dibuang. Timestamp
      // bukan syarat memproses pesan, jadi sekarang pesannya TETAP diproses -
      // cukup dicatat supaya ketahuan kalau bentuk datanya berubah.
      catatPesan('[WAKTU PESAN]', 'Timestamp tidak terbaca - pesan tetap diproses', jejak);
    } else {
      const umur = now - timestamp; // + = pesan lama, - = pesan "masa depan"

      if (umur < -TOLERANSI_JAM_DEPAN_DETIK) {
        // Pesan TIDAK dibuang: selisih jam bukan kesalahan pengirim pesan.
        if (Date.now() - logSkewTerakhir > JEDA_LOG_SKEW) {
          logSkewTerakhir = Date.now();
          // Sengaja TETAP tampil di production: maksimal sekali per 10 menit,
          // dan jam yang meleset harus segera diketahui pemilik bot.
          console.log(
            chalk.yellow(
              `[JAM SERVER] Jam komputer/VPS tertinggal ~${Math.abs(umur)} detik dari WhatsApp. ` +
                `Sinkronkan jam (NTP) supaya penyaringan pesan tetap akurat.`,
            ),
          );
        }
      } else if (umur > MAKS_UMUR_PESAN_DETIK) {
        lewatiPesan(`Pesan terlalu lama (${umur} detik, batas ${MAKS_UMUR_PESAN_DETIK} detik)`, {
          ...jejak,
          kemungkinan: 'antrean lama saat bot baru nyala / jam server kedepan',
        });
        return null;
      }
    }

    // console.log(JSON.stringify(message, null, 2));
    // console.log('______________________________');

    let remoteJid = key.remoteJid || key.remoteJidAlt || '';
    const fromMe = key.fromMe || false;
    const id = key.id || '';
    const participant = key.participantAlt || key.participant || message.participant || '';
    const participant2 = key.participant || message.participant || '';
    const pushName = message.pushName || '';

    // kalau di pribadi
    /**
      remoteJid: '69243815079978@lid',
    remoteJidAlt: '6285246154386@s.whatsapp.net',


    kalau di grub

    participant: '69243815079978@lid',
    participantAlt: '6285246154386@s.whatsapp.net',
     */

    const isGroup = remoteJid.endsWith('@g.us');
    const isBroadcast = remoteJid.endsWith('status@broadcast');

    if (!isGroup && !remoteJid.endsWith('@s.whatsapp.net')) {
      remoteJid = key.remoteJid || key.remoteJidAlt;
    }

    let sender = isGroup ? participant : remoteJid;
    // senderLid harus selalu LID (@lid) baik di grup maupun pribadi, supaya
    // cek owner/premium & data user konsisten. Di pribadi remoteJid bisa @lid
    // atau @s.whatsapp.net tergantung addressing mode, jadi pilih yang @lid.
    const pickLid = (...jids) => jids.find((j) => typeof j === 'string' && j.endsWith('@lid'));
    let senderLid = isGroup
      ? pickLid(key.participant, key.participantAlt, message.participant) || participant2
      : pickLid(key.remoteJid, key.remoteJidAlt) || key.remoteJidAlt || remoteJid;
    const senderType = getSenderType(sender);

    const isQuoted = isQuotedMessage(message);
    const isDeleted = message?.message?.protocolMessage?.type === 0;

    const isEdited =
      message?.message?.protocolMessage?.editedMessage?.extendedTextMessage?.text ||
      message?.message?.protocolMessage?.editedMessage?.conversation ||
      message?.message?.editedMessage ||
      null;

    let objisEdited = {};
    if (isEdited) {
      objisEdited = {
        status: true,
        id: message?.message?.protocolMessage?.key?.id || null,
        text: isEdited,
      };
    }

    const isForwarded = detectForwarded(message.message);

    const isBot =
      (id?.startsWith('3EB0') && id.length === 22) ||
      Object.keys(message?.message || {}).some((k) =>
        ['templateMessage', 'interactiveMessage', 'buttonsMessage'].includes(k),
      );
    let antitagsw = Boolean(
      message?.message?.groupStatusMentionMessage ||
      message?.message?.groupStatusMentionMessageV2 ||
      message?.message?.groupStatusMentionMessage?.message?.protocolMessage?.type ===
        'STATUS_MENTION_MESSAGE' ||
      message?.message?.groupStatusMentionMessageV2?.message?.protocolMessage?.type ===
        'STATUS_MENTION_MESSAGE',
    );

    let isTagSwGc = false;

    if (remoteJid === 'status@broadcast' && message?.message?.senderKeyDistributionMessage) {
      antitagsw = true;
      sender = participant;
    }

    if (isBroadcast && !antitagsw) {
      console.log('Broadcast message detected, ignoring.');

      return null;
    }

    let content = '';
    let messageType = '';
    let isTagMeta = false;

    if (message.message) {
      const rawMessageType = getContentType(message.message);
      isTagMeta = rawMessageType === 'botInvokeMessage';

      isTagSwGc = Boolean(
        rawMessageType === 'groupStatusMessageV2' ||
        message?.message?.groupStatusMessageV2 ||
        (message?.key?.remoteJid?.endsWith('@g.us') && message?.message?.groupStatusMessageV2),
      );

      // getContentType() melewati pembungkus seperti `messageContextInfo` dan
      // mengembalikan tipe konten yang sebenarnya. `Object.keys()[0]` tidak:
      // zapo kerap menaruh `messageContextInfo` sebagai key PERTAMA, sehingga
      // `type` di messageInfo jadi 'messageContextInfo' dan semua plugin yang
      // bercabang berdasarkan tipe pesan salah jalan.
      messageType = rawMessageType || Object.keys(message.message)[0];

      content =
        message?.message?.conversation ||
        message?.message?.extendedTextMessage?.text ||
        message?.message?.imageMessage?.caption ||
        message?.message?.videoMessage?.caption ||
        message?.message?.documentMessage?.caption ||
        message?.message?.text ||
        message?.message?.selectedButtonId ||
        message?.message?.singleSelectReply?.selectedRowId ||
        message?.message?.selectedId ||
        message?.message?.contentText ||
        message?.message?.selectedDisplayText ||
        message?.message?.title ||
        '';

      if (message?.message?.reactionMessage) {
        messageType = 'reactionMessage';
        content = message.message.reactionMessage?.text || '[REACT DIHAPUS]';
      }

      if (message.message?.pollUpdateMessage) return null;
      if (message.message?.pinInChatMessage) return null;
    } else if (message.key.isViewOnce) {
      messageType = 'viewOnceMessage';
    } else {
      console.log('Tidak ada konten pesan yang dapat diproses.');
      //console.log(message);
      return null;
    }

    // Simpan konten ASLI (newline & spasi apa adanya) untuk dipakai sebagai isi pesan.
    const rawContent = content || '';

    // Normalisasi seluruh spasi berlebih (spasi ganda, tab, newline) menjadi satu spasi
    // HANYA untuk proses parsing command, agar "h tes", "h  tes", "h   tes" tetap
    // terdeteksi — tanpa merusak rawContent yang menyimpan newline asli.
    let normalized = rawContent.replace(/\s+/g, ' ').trim();

    // Pertahankan dukungan prefix diikuti spasi (mis. ". on" -> ".on")
    const prefixWithSpace = config.prefix.find((p) => normalized.startsWith(p + ' '));
    if (prefixWithSpace) {
      normalized = prefixWithSpace + normalized.slice(prefixWithSpace.length + 1);
    }

    const parts = normalized.split(' '); // normalized sudah dinormalisasi, aman di-split per satu spasi
    let command = parts[0].toLowerCase();

    const usedPrefix = config.prefix.find((p) => command.startsWith(p));

    command = usedPrefix
      ? command.slice(usedPrefix.length)
      : config.status_prefix
        ? false
        : command;

    // Ambil isi setelah command DARI rawContent agar newline (multi-baris) tetap terjaga.
    const contentWithoutCommand = stripCommandToken(rawContent, prefixWithSpace);

    const quotedMessage = isQuoted
      ? {
          text: message.message.extendedTextMessage?.contextInfo?.quotedMessage?.conversation || '',
          sender: message.message.extendedTextMessage?.contextInfo?.participant || '',
          id: message.message.extendedTextMessage?.contextInfo?.stanzaId || '',
        }
      : null;

    return {
      id,
      timestamp: message.messageTimestamp,
      sender,
      senderLid,
      pushName,
      isGroup,
      fromMe,
      remoteJid,
      type: getMessageType(messageType),
      content: contentWithoutCommand,
      message,
      isTagSw: antitagsw,
      isTagSwGc,
      prefix: usedPrefix || '',
      command,
      fullText: normalized,
      isQuoted,
      quotedMessage,
      mentionedJid:
        message?.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
        message?.message?.imageMessage?.contextInfo?.mentionedJid ||
        message?.message?.videoMessage?.contextInfo?.mentionedJid ||
        message?.message?.documentMessage?.contextInfo?.mentionedJid ||
        message?.message?.audioMessage?.contextInfo?.mentionedJid ||
        message?.message?.stickerMessage?.contextInfo?.mentionedJid ||
        null ||
        false,
      isBot,
      isTagMeta,
      isForwarded,
      senderType,
      m: {
        remoteJid,
        key,
        message,
        sock,
        isDeleted,
        isEdited: objisEdited,
        m,
      },
    };
  } catch (error) {
    // Fungsi ini memparsing SETIAP pesan masuk. Kalau gagal, pesan itu hilang
    // tanpa jejak dan gejalanya di lapangan hanya "bot tidak merespons".
    // Behavior tetap sama (return null), tapi penyebabnya sekarang tercatat.
    try {
      const key = m?.messages?.[0]?.key || {};
      logLine(
        'serialize.log',
        `[SERIALIZE_ERROR] ${error?.message || error} | MessageID: ${key.id || '-'} | RemoteJid: ${
          key.remoteJid || '-'
        } | Type: ${m?.type || '-'}`,
      );
    } catch {
      // logging tidak boleh ikut menjatuhkan pemrosesan pesan
    }
    console.error('[SERIALIZE_MESSAGE]', error?.message || error);
    return null;
  }
}

export default serializeMessage;
