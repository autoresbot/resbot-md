import {
  checkMessage,
  getWelcomeMedia,
  getLeftMedia,
  getAutoDelete,
} from './participants.js';
import fs from 'fs';
import path from 'path';
const ApiAutoresbot = await import('api-autoresbot').then((mod) => mod.default || mod);
import axios from 'axios';
import config from '../config.js';
import {
  logWithTime,
  getCurrentDate,
  sendMessageWithMentionNotQuoted,
  sendImagesWithMentionNotQuoted,
  sendVideoWithMentionNotQuoted,
  getCurrentTime,
  getGreeting,
  getHari,
  logTracking,
  getSenderType,
} from './utils.js';
import { getGroupMetadata, getProfilePictureUrl } from './cache.js';
import { findGroup } from './group.js';
import { updateUser, findUser } from './users.js';

/**
 * Endpoint gambar sapaan.
 *
 * 'default' adalah template baru yang hanya butuh foto profil + nama, jadi
 * tetap jalan walau data grup tidak lengkap. Angka 1-7 template lama.
 */
const ENDPOINT_WELCOME = {
  default: '/api/maker/welcome',
  1: '/api/maker/welcome1',
  2: '/api/maker/welcome2',
  3: '/api/maker/welcome3',
  4: '/api/maker/welcome4',
  5: '/api/maker/welcome5',
  6: '/api/maker/welcome6',
  7: '/api/maker/welcome7',
};

const ENDPOINT_LEFT = {
  default: '/api/maker/goodbye',
};

async function getWelcomeBuffer(api, type, options, endpoints = ENDPOINT_WELCOME) {
  const url = 'https://api.autoresbot.com';
  const endpoint = endpoints[type];
  if (!endpoint) return null;

  try {
    const response = await axios.post(`${url}${endpoint}`, options, {
      responseType: 'arraybuffer', // Mengembalikan data sebagai buffer
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error('Error fetching welcome buffer:', error.message);
    return null;
  }
}

async function handleDetectBlackList(sock, remoteJid, senderLid) {
  try {
    const statusJid = getSenderType(senderLid);
    // Ambil data grup dari database
    const dataGroupSettings = await findGroup(remoteJid);
    if (!dataGroupSettings) return true;

    const { fitur } = dataGroupSettings;
    if (!fitur.detectblacklist && !fitur.detectblacklist2) return true;

    const user = await findUser(senderLid);
    if (!user) return true;

    const [docId, userData] = user;

    if (userData.status === 'blacklist') {
      if (fitur.detectblacklist) {
        const warningMessage = `⚠️ _Peringatan Blacklist_\n\n@${
          senderLid.split('@')[0]
        } telah di blacklist.`;
        logTracking(`Participant Update - Peringatan Blacklist (${senderLid})`);
        await sendMessageWithMentionNotQuoted(sock, remoteJid, warningMessage, statusJid);
      }

      if (fitur.detectblacklist2) {
        logTracking(`Participant Update - Peringatan Blacklist2 di kick (${senderLid})`);
        await sock.groupParticipantsUpdate(remoteJid, [senderLid], 'remove');
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('Error handling blacklist detection:', error);
    return true;
  }
}

async function handleActiveFeatures(sock, messageInfo, settingGroups) {
  const { id, action, participants, store } = messageInfo;

  if (!id || !action || !participants || participants.length === 0) {
    console.error('Invalid message information provided');
    return;
  }

  const { promote = false, demote = false, welcome = false, left = false } = settingGroups;

  // ✅ Ambil targetNumber secara aman dari object participant
  const participant = participants[0];
  const targetNumber = participant?.phoneNumber || participant?.id || participant;
  const cleanNumber = typeof targetNumber === 'string' ? targetNumber.split('@')[0] : 'unknown';
  const targetMention = `@${cleanNumber}`;

  const api = new ApiAutoresbot(config.APIKEY);
  const statusJid = getSenderType(targetNumber);

  // ✅ Pastikan blacklist dicek pakai ID yang benar
  const isBlacklist = await handleDetectBlackList(sock, id, targetNumber);
  if (!isBlacklist) return false;

  // ✅ Cek setting grup
  const actions = {
    promote: promote,
    demote: demote,
    remove: left,
    add: welcome,
  };

  if (!actions[action]) {
    logWithTime('SYSTEM', `Fitur ${action} tidak aktif`);
    return;
  }

  // Teks bawaan kalau admin belum pernah mengatur teksnya.
  //
  // Dulu tanpa teks bot DIAM TOTAL walau fiturnya sudah .on dan tampilannya
  // sudah diatur — sementara .teswelcome/.tesleft tetap tampil (keduanya punya
  // teks cadangan sendiri), jadi seolah-olah setelannya sudah benar.
  const TEKS_BAWAAN = {
    add: 'Selamat datang @name di grup @group',
    remove: 'Selamat tinggal @name',
    promote: 'Selamat @name, kamu sekarang admin grup ini',
    demote: '@name bukan lagi admin grup ini',
  };

  const result = (await checkMessage(id, action)) || TEKS_BAWAAN[action];
  if (!result) return;

  // ✅ Ambil template welcome
  let typeWelcome;
  const templatewelcome = await checkMessage(id, 'templatewelcome');
  typeWelcome = templatewelcome || config.typewelcome;

  const groupMetadata = await getGroupMetadata(sock, id);
  if (!groupMetadata) {
    console.error('Failed to fetch group metadata');
    return;
  }

  // ✅ Ambil foto profil dengan fallback aman
  const ppUser = await getProfilePictureUrl(sock, targetNumber);
  const ppGroup = await getProfilePictureUrl(sock, id);
  const contact = store.contacts[targetNumber];

  const pushName =
    contact?.verifiedName ||
    contact?.notify ||
    (typeof targetNumber === 'string' ? cleanNumber : 'Unknown');

  const { subject, desc, size } = groupMetadata;
  const date = getCurrentDate();
  const time = getCurrentTime();
  const greeting = getGreeting();
  const day = getHari();

  // ✅ Ganti placeholder di template
  const replacements = {
    '@name': targetMention,
    '@date': date,
    '@day': day,
    '@desc': desc,
    '@group': subject,
    '@greeting': greeting,
    '@size': size,
    '@time': time,
  };

  let customizedMessage = result;
  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(key.replace(/@/, '@'), 'gi');
    customizedMessage = customizedMessage.replace(regex, value);
  }

  /**
   * Hapus pesan sapaan setelah sekian detik (.autodelwelcome / .autodelleft).
   *
   * Timer hanya ada di memori: kalau bot restart sebelum waktunya, pesan itu
   * tidak jadi terhapus. Tidak dibuat persisten karena ini sekadar perapi grup.
   */
  const jadwalkanHapus = (hasilKirim, detik) => {
    if (!detik || !hasilKirim?.key) return;

    setTimeout(async () => {
      try {
        await sock.sendMessage(id, { delete: hasilKirim.key });
      } catch (error) {
        console.warn(`[AUTODEL] Gagal menghapus sapaan di ${id}: ${error?.message || error}`);
      }
    }, detik * 1000).unref?.(); // jangan menahan proses tetap hidup
  };

  // Foto/video/gambar template dikirim lewat jalur yang sama untuk welcome
  // (add) maupun perpisahan (remove) — dulu 'remove' hanya bisa teks.
  const kirimSapaan = async (mode, mediaTersimpan, endpoints, labelLog, autoDelDetik = 0) => {
    if (mode === 'text') {
      logTracking(`Participant Update - Send text ke (${id})`);
      const hasil = await sendMessageWithMentionNotQuoted(sock, id, customizedMessage, statusJid);
      jadwalkanHapus(hasil, autoDelDetik);
      return;
    }

    // Foto/video milik grup sendiri (.setwelcome / .setleft foto|video)
    if (mode === 'media') {
      const media = mediaTersimpan;
      const filePath = media ? path.join(process.cwd(), 'database', 'media', media.file) : null;

      if (filePath && fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        logTracking(`Participant Update - Send ${media.tipe} ke (${id})`);

        const hasil =
          media.tipe === 'video'
            ? await sendVideoWithMentionNotQuoted(
                sock,
                id,
                buffer,
                customizedMessage,
                statusJid,
                media.gif === true, // hanya GIF yang diputar berulang
              )
            : await sendImagesWithMentionNotQuoted(sock, id, buffer, customizedMessage, statusJid);

        jadwalkanHapus(hasil, autoDelDetik);
        return;
      }

      // File hilang (mis. terhapus manual) -> jangan diam, kirim teksnya saja.
      console.warn(`[${labelLog}] File media grup ${id} tidak ditemukan, dikirim sebagai teks`);
      const hasilTeks = await sendMessageWithMentionNotQuoted(sock, id, customizedMessage, statusJid);
      jadwalkanHapus(hasilTeks, autoDelDetik);
      return;
    }

    const buffer = await getWelcomeBuffer(
      api,
      mode,
      {
        pp: ppUser,
        name: pushName,
        gcname: subject,
        member: size,
        ppgc: ppGroup,
        desk: desc,
        bg: config.bgwelcome2,
      },
      endpoints,
    );

    if (buffer) {
      logTracking(`Participant Update - Send Image ke (${id})`);
      const hasil = await sendImagesWithMentionNotQuoted(
        sock,
        id,
        buffer,
        customizedMessage,
        statusJid,
      );
      jadwalkanHapus(hasil, autoDelDetik);
      return;
    }

    // API gagal/template tidak dikenal: teksnya tetap dikirim supaya anggota
    // baru tidak lewat tanpa sapaan sama sekali.
    console.warn(`[${labelLog}] Gambar gagal dibuat (mode: ${mode}), dikirim sebagai teks`);
    const hasilCadangan = await sendMessageWithMentionNotQuoted(
      sock,
      id,
      customizedMessage,
      statusJid,
    );
    jadwalkanHapus(hasilCadangan, autoDelDetik);
  };

  // ✅ Kirim pesan untuk promote/demote
  if (['promote', 'demote'].includes(action)) {
    if (actions[action]) {
      logTracking(`Participant Update - Send text ke (${id})`);
      await sendMessageWithMentionNotQuoted(sock, id, customizedMessage, statusJid);
    }
    return;
  }

  // ✅ Kirim pesan perpisahan (.setleft)
  if (action === 'remove' && actions.remove) {
    const templateleft = await checkMessage(id, 'templateleft');
    await kirimSapaan(
      templateleft || 'text',
      getLeftMedia(id),
      ENDPOINT_LEFT,
      'LEFT',
      getAutoDelete(id, 'left'),
    );
    return;
  }

  // ✅ Kirim pesan untuk add/welcome
  if (action === 'add' && welcome) {
    if (typeWelcome === 'random') {
      const randomTypes = ['default', '1', '2', '3', '4', '5', '6', 'text'];
      typeWelcome = randomTypes[Math.floor(Math.random() * randomTypes.length)];
    }

    await kirimSapaan(
      typeWelcome,
      getWelcomeMedia(id),
      ENDPOINT_WELCOME,
      'WELCOME',
      getAutoDelete(id, 'welcome'),
    );
  }
}

export { handleActiveFeatures };
