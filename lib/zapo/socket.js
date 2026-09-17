/**
 * Facade `sock` bergaya Baileys di atas `WaClient` zapo-js.
 *
 * Alasan keberadaan file ini: ada 1200+ pemanggilan `sock.sendMessage` dan
 * ratusan pemanggilan method lain yang tersebar di 334 plugin. Menerjemahkan
 * semuanya satu per satu berisiko dan tidak bisa di-review; sebagai gantinya
 * seluruh perbedaan API dikurung di sini, sehingga plugin tetap memakai
 * bentuk panggilan yang sama seperti sebelumnya.
 *
 * Yang TIDAK ditiru di sini sengaja dibiarkan melempar error yang jelas,
 * bukan diam-diam mengembalikan undefined — lihat catatan di perubahan.md.
 */

import { EventEmitter } from 'events';
import { toZapoContent, buildSendOptions } from './content.js';
import { devlog, isDevLogEnabled, summarizeKey } from '../devlog.js';

/** Buang device-id (`:12`) sebelum `@`, mis. `628xx:12@lid` -> `628xx@lid`. */
const stripDevice = (jid) => (typeof jid === 'string' ? jid.replace(/:\d+(?=@)/, '') : jid);

/**
 * Cache pemetaan LID <-> nomor telepon.
 *
 * zapo hanya menyediakan arah nomor -> LID. Arah sebaliknya (yang dibutuhkan
 * `convertToJid` / `resolveSendableJid` di lib/utils.js) tidak ada API-nya,
 * TAPI datanya lewat sendiri di dua tempat: setiap pesan masuk membawa
 * `remoteJidAlt`/`participantAlt`, dan metadata grup membawa `lid`/`phoneNumber`
 * untuk tiap anggota. Keduanya dipanen ke sini.
 */
function createLidMappingCache() {
  const lidToPn = new Map();
  const pnToLid = new Map();

  return {
    remember(lidJid, pnJid) {
      const lid = stripDevice(lidJid);
      const pn = stripDevice(pnJid);
      if (!lid?.endsWith('@lid') || !pn?.endsWith('@s.whatsapp.net')) return;
      lidToPn.set(lid, pn);
      pnToLid.set(pn, lid);
    },
    getPn: (lidJid) => lidToPn.get(stripDevice(lidJid)) ?? null,
    getLid: (pnJid) => pnToLid.get(stripDevice(pnJid)) ?? null,
    get size() {
      return lidToPn.size;
    },
  };
}

/**
 * Samakan bentuk peserta grup zapo dengan bentuk Baileys.
 *
 * Kode lama memeriksa admin dengan pola yang dipakai di 71 tempat:
 *
 *     (p) => (p.phoneNumber === sender || p.id === sender) && p.admin
 *
 * zapo tidak punya `id` maupun `admin` — ia memakai `jid` dan boolean
 * `isAdmin`/`isSuperAdmin`. Akibatnya `p.admin` selalu `undefined` dan SEMUA
 * pemeriksaan admin gagal ("⚠️ Perintah ini Hanya Untuk Admin" walau pengirim
 * memang admin). Field zapo tetap dipertahankan supaya kode baru bisa memakainya.
 */
function normalizeGroupMetadata(metadata, lidCache) {
  if (!metadata || typeof metadata !== 'object') return metadata;

  // Sebagian sumber (mis. queryGroupInviteInfo, createGroup) tidak membawa
  // daftar peserta — `id` dan `isCommunity` tetap harus dipetakan.
  const participants = (metadata.participants ?? []).map((p) => {
    // Panen pemetaan LID -> nomor sekalian: sekali ambil metadata grup, seluruh
    // anggotanya ikut terpetakan.
    lidCache.remember(p.lid ?? p.jid, p.phoneNumber);

    // WhatsApp tidak selalu mengirim `phone_number` per peserta. Kalau kosong,
    // cache dipakai supaya perbandingan `p.phoneNumber === sender` tetap jalan.
    const phoneNumber = p.phoneNumber ?? lidCache.getPn(p.lid ?? p.jid) ?? undefined;

    return {
      ...p,
      id: p.jid, // Baileys: `id`
      admin: p.isSuperAdmin ? 'superadmin' : p.isAdmin ? 'admin' : null,
      phoneNumber,
    };
  });

  return {
    ...metadata,
    id: metadata.jid, // Baileys: `id`
    // Baileys: `isCommunity`. Tanpa ini `.jpm` menyaring dengan
    // `g.isCommunity == false` yang bernilai false untuk `undefined`, sehingga
    // SEMUA grup ikut tersaring habis dan broadcast tidak terkirim ke siapa pun.
    isCommunity: !!metadata.isParentGroup,
    participants,
  };
}

/** Baileys `groupSettingUpdate` -> pasangan (setting, enabled) milik zapo. */
const GROUP_SETTINGS = {
  announcement: ['announcement', true],
  not_announcement: ['announcement', false],
  locked: ['restrict', true],
  unlocked: ['restrict', false],
};

/** Baileys `groupParticipantsUpdate` action -> method coordinator zapo. */
const PARTICIPANT_ACTIONS = {
  add: 'addParticipants',
  remove: 'removeParticipants',
  promote: 'promoteParticipants',
  demote: 'demoteParticipants',
};

/**
 * Bungkus WaClient jadi objek mirip socket Baileys.
 *
 * @param {import('zapo-js').WaClient} client
 * @param {{ contacts?: Record<string, any> }} [deps]
 */
export function createBaileysCompatSocket(client, deps = {}) {
  const ev = new EventEmitter();
  ev.setMaxListeners(0);

  const contacts = deps.contacts ?? {};

  // `sock.chats` di Baileys adalah objek biasa yang dibaca sinkron
  // (`Object.keys(sock.chats)`), sedangkan thread store zapo async. Jadi isinya
  // dicermin ke objek ini: dimuat sekali saat koneksi terbuka, lalu ditambah
  // setiap ada chat baru yang terlihat.
  const chats = {};
  const lidCache = createLidMappingCache();

  const sock = {
    /** Akses langsung ke client zapo, untuk kode yang butuh API asli. */
    zapo: client,
    ev,
    contacts,
    chats,
    user: null,
    authState: { creds: { registered: false } },
    /**
     * Apakah sesi siap MENGIRIM pesan?
     *
     * zapo melempar "sendMessage requires registered meJid" bila kredensial
     * sedang kosong — itu terjadi saat socket sudah putus/sedang reconnect
     * sementara pesan yang sempat masuk masih diproses. Pemanggil bisa
     * memeriksanya dulu daripada menabrak error itu di tengah jalan.
     */
    sessionReady: () => !!client.auth?.getCurrentCredentials?.()?.meJid,
    // `close()` menutup socket saja (disconnect), BUKAN logout — logout akan
    // meng-unlink device dari WhatsApp dan memaksa pairing ulang.
    ws: { readyState: 0, close: () => client.disconnect().catch(() => {}) },
  };

  wireEvents(client, sock, contacts, chats, lidCache);

  /**
   * Muat ulang `sock.chats` dari thread store zapo.
   *
   * Store-nya dioper dari pemanggil karena `client.stores` privat — tidak ada
   * jalan mengambilnya dari instance WaClient.
   */
  sock.refreshChats = async () => {
    if (!deps.storeSession?.threads) return chats;
    try {
      const records = await deps.storeSession.threads.list();
      for (const record of records) chats[record.jid] = record;
    } catch (error) {
      // Thread store bisa dimatikan lewat konfigurasi store; jangan sampai
      // membuat koneksi gagal hanya karena daftar chat tidak tersedia.
      console.warn('[CHATS] Gagal memuat daftar chat:', error?.message || error);
    }
    return chats;
  };

  /* ------------------------- PESAN ------------------------- */

  sock.sendMessage = async (jid, content, options = {}) => {
    const zapoContent = await toZapoContent(content);
    const sendOptions = buildSendOptions(content, options);

    let result;
    try {
      result = await client.message.send(jid, zapoContent, sendOptions);
    } catch (error) {
      // Kegagalan kirim sering tertelan try/catch pemanggil, jadi dicatat di
      // sini bersama bentuk konten aslinya — itu yang dibutuhkan untuk tahu
      // apakah penerjemahan konten yang salah atau memang ditolak server.
      devlog('send', {
        ok: false,
        jid,
        baileysKeys: content && typeof content === 'object' ? Object.keys(content) : typeof content,
        zapoType: zapoContent?.type ?? Object.keys(zapoContent ?? {})[0],
        options: sendOptions,
        error: error?.message ?? String(error),
      });
      throw error;
    }

    devlog('send', {
      ok: true,
      jid,
      baileysKeys: content && typeof content === 'object' ? Object.keys(content) : typeof content,
      zapoType: zapoContent?.type ?? Object.keys(zapoContent ?? {})[0],
      options: sendOptions,
      messageId: result?.id,
    });

    // Baileys mengembalikan objek pesan lengkap; sebagian plugin memakai
    // `.key.id` dari hasil kirim (mis. untuk menghapus/mengedit pesan itu
    // lagi), jadi bentuk minimal itu ditiru di sini.
    return {
      key: { remoteJid: jid, fromMe: true, id: result?.id },
      message: zapoContent,
      status: 1,
      zapoResult: result,
    };
  };

  sock.relayMessage = async (jid, message, options = {}) =>
    client.message.send(jid, message, buildSendOptions({}, options));

  /**
   * Tandai pesan sudah dibaca (centang biru / autoread).
   *
   * Dulu di sini receipt dikirim lewat bentuk `(jid, ids, { type: 'read' })`.
   * Bentuk itu TIDAK membawa `participant`, padahal receipt untuk chat GRUP dan
   * broadcast wajib menyebut siapa pengirim pesan aslinya
   * (`aggregateReceiptTargets` di zapo: `needsParticipant`). Tanpa itu receipt
   * grup diabaikan server — autoread cuma terlihat jalan di chat pribadi.
   *
   * Sekarang key-nya diteruskan sebagai event supaya zapo sendiri yang
   * menurunkan `participant` (lengkap dengan device pengirim) dan
   * mengelompokkan id per chat.
   */
  sock.readMessages = async (keys) => {
    if (!Array.isArray(keys) || !keys.length) return;

    const events = [];
    for (const key of keys) {
      if (!key?.remoteJid || !key?.id) continue;
      const remoteJid = key.remoteJid;
      events.push({
        key: {
          ...key,
          remoteJid,
          // Key dari plugin kadang sudah dipreteli (hanya remoteJid + id), jadi
          // penanda jenis chat dihitung ulang dari jid-nya bila belum ada.
          isGroup: key.isGroup ?? remoteJid.endsWith('@g.us'),
          isBroadcast: key.isBroadcast ?? remoteJid.endsWith('@broadcast'),
          participant: key.participant ?? key.participantAlt,
        },
      });
    }

    if (!events.length) return;
    await client.message.sendReceipt(events, { type: 'read' });
  };

  sock.sendPresenceUpdate = async (type, jid) => {
    if (type === 'available' || type === 'unavailable') {
      return client.presence.send(type);
    }
    if (!jid) return;
    return client.presence.sendChatstate(jid, { type });
  };

  sock.waUploadToServer = (stream, opts = {}) =>
    client.message.upload(stream, { type: opts.mediaType ?? opts.type ?? 'image', ...opts });

  sock.downloadMediaMessage = (source, options) => client.message.downloadBytes(source, options);

  /* -------------------------- GRUP ------------------------- */

  sock.groupMetadata = async (jid) => {
    const metadata = await client.group.queryGroupMetadata(jid);
    return normalizeGroupMetadata(metadata, lidCache);
  };
  // Hasilnya dinormalkan seperti groupMetadata: pemanggil membaca `creategc.id`
  // (bentuk Baileys), sedangkan zapo mengembalikan `jid`. Tanpa ini `.id`
  // bernilai undefined dan pemanggilan berikutnya gagal dengan
  // "Cannot read properties of undefined (reading 'indexOf')".
  sock.groupCreate = async (subject, participants) =>
    normalizeGroupMetadata(await client.group.createGroup(subject, participants), lidCache);
  sock.groupLeave = (jid) => client.group.leaveGroup([jid]);
  sock.groupInviteCode = (jid) => client.group.queryInviteCode(jid);
  sock.groupRevokeInvite = (jid) => client.group.revokeInvite(jid);
  sock.groupAcceptInvite = async (code) => (await client.group.joinGroupViaInvite(code))?.jid;
  sock.groupGetInviteInfo = async (code) =>
    normalizeGroupMetadata(await client.group.queryGroupInviteInfo(code), lidCache);
  sock.groupUpdateSubject = (jid, subject) => client.group.setSubject(jid, subject);
  sock.groupUpdateDescription = (jid, description) => client.group.setDescription(jid, description);
  sock.groupToggleEphemeral = (jid, seconds) => client.group.setEphemeralDuration(jid, seconds);

  sock.groupParticipantsUpdate = async (jid, participants, action) => {
    const method = PARTICIPANT_ACTIONS[action];
    if (!method) throw new Error(`Aksi participant tidak dikenal: ${action}`);
    return client.group[method](jid, participants);
  };

  sock.groupSettingUpdate = async (jid, setting) => {
    const mapped = GROUP_SETTINGS[setting];
    if (!mapped) throw new Error(`Setting grup tidak dikenal: ${setting}`);
    return client.group.setSetting(jid, mapped[0], mapped[1]);
  };

  sock.groupFetchAllParticipating = async () => {
    const all = await client.group.queryAllGroups();
    // Baileys mengembalikan objek ber-key jid, bukan array.
    return Object.fromEntries(all.map((g) => [g.jid, normalizeGroupMetadata(g, lidCache)]));
  };

  sock.groupRequestParticipantsList = (jid) => client.group.queryMembershipApprovalRequests(jid);
  sock.groupRequestParticipantsUpdate = async (jid, participants, action) =>
    action === 'approve'
      ? client.group.approveMembershipRequests(jid, participants)
      : client.group.rejectMembershipRequests(jid, participants);

  /* ------------------------ PROFIL ------------------------- */

  sock.profilePictureUrl = async (jid, type = 'preview') => {
    const res = await client.profile.getProfilePicture(jid, type);
    return res?.url ?? null;
  };

  sock.updateProfilePicture = async (jid, image) => {
    const bytes = await toBytes(image);
    // zapo mengunggah byte APA ADANYA — tidak transcode, tidak resize, tidak
    // crop. Baileys dulu melakukannya sendiri.
    const jpeg = await toProfilePictureJpeg(bytes);
    const target = profilePictureTarget(jid);

    devlog('send', {
      aksi: 'updateProfilePicture',
      jidDiminta: jid,
      target: target ?? '(akun sendiri)',
      ukuranJpeg: jpeg.length,
    });

    return client.profile.setProfilePicture(jpeg, target);
  };

  sock.removeProfilePicture = (jid) =>
    client.profile.deleteProfilePicture(profilePictureTarget(jid));
  sock.updateProfileStatus = (status) => client.profile.setStatus(status);
  sock.updateProfileName = (name) => client.profile.setPushName(name);
  sock.fetchStatus = (jid) => client.profile.getStatus(jid);

  sock.onWhatsApp = async (...jids) => {
    const list = jids.flat().filter(Boolean);
    const results = await client.profile.getLidsByPhoneNumbers(list);
    return results.map((r) => ({
      jid: r.phoneJid,
      lid: r.lidJid,
      exists: r.exists,
    }));
  };

  sock.updateBlockStatus = (jid, action) =>
    action === 'block' ? client.privacy.blockUser(jid) : client.privacy.unblockUser(jid);

  sock.fetchBlocklist = async () => (await client.privacy.getBlocklist())?.jids ?? [];

  /* ------------------------- CHAT -------------------------- */

  sock.chatModify = async (mod, jid) => {
    if (mod.clear) {
      if (Array.isArray(mod.clear.messages)) {
        for (const msg of mod.clear.messages) {
          await client.chat.deleteMessageForMe({ ...msg, remoteJid: jid });
        }
        return;
      }
      return client.chat.clearChat(jid);
    }
    if (mod.delete) return client.chat.deleteChat(jid);
    if ('archive' in mod) return client.chat.setChatArchive(jid, !!mod.archive);
    if ('pin' in mod) return client.chat.setChatPin(jid, !!mod.pin);
    if ('markRead' in mod) return client.chat.setChatRead(jid, !!mod.markRead);
    if ('mute' in mod) return client.chat.setChatMute(jid, mod.mute != null, mod.mute ?? undefined);
    if (mod.star) return client.chat.setMessageStar(mod.star.messages?.[0], !!mod.star.star);
    throw new Error(`chatModify tidak dikenal: ${Object.keys(mod).join(', ')}`);
  };

  /* ---------------------- LEVEL RENDAH --------------------- */

  sock.query = (node, timeoutMs) => client.lowlevel.query(normalizeQueryNode(node), timeoutMs);
  sock.sendNode = (node) => client.lowlevel.sendNode(node);
  sock.logout = () => client.logout();

  sock.requestPairingCode = (phoneNumber, customCode) =>
    client.auth.requestPairingCode(phoneNumber, undefined, customCode);

  /**
   * Baileys memakai `signalRepository.lidMapping` untuk memetakan LID <-> nomor.
   *
   * Arah nomor -> LID ditanyakan ke server. Arah LID -> nomor tidak punya API di
   * zapo, jadi dilayani dari cache yang diisi pesan masuk + metadata grup; kalau
   * belum pernah terlihat, hasilnya `null` (sama seperti Baileys untuk kontak
   * yang tak dikenal).
   */
  sock.signalRepository = {
    lidMapping: {
      getPNForLID: async (lid) => lidCache.getPn(lid),
      getLIDForPN: async (pn) => {
        const cached = lidCache.getLid(pn);
        if (cached) return cached;

        const [hit] = await client.profile.getLidsByPhoneNumbers([pn]);
        if (hit?.lidJid) lidCache.remember(hit.lidJid, hit.phoneJid ?? pn);
        return hit?.lidJid ?? null;
      },
    },
  };

  /** Statistik cache LID, untuk debugging dari plugin. */
  sock.lidMappingSize = () => lidCache.size;

  return sock;
}

/** Sambungkan event zapo ke nama event Baileys yang dipakai project ini. */
function wireEvents(client, sock, contacts, chats, lidCache) {
  const { ev } = sock;

  client.on('connection', (event) => {
    if (event.status === 'open') {
      sock.ws.readyState = 1;
      sock.authState.creds.registered = true;
      const creds = client.auth?.getCurrentCredentials?.() ?? null;
      if (creds?.meJid) sock.user = { id: creds.meJid, name: creds.pushName };
      sock.refreshChats?.().catch(() => {});
      ev.emit('connection.update', { connection: 'open' });
      return;
    }

    sock.ws.readyState = 3;
    ev.emit('connection.update', {
      connection: 'close',
      lastDisconnect: {
        error: Object.assign(new Error(event.reason), {
          output: { statusCode: event.code ?? event.reason },
        }),
        date: new Date(),
      },
      // Dipakai lib/connection.js untuk memutuskan berhenti reconnect.
      isLogout: event.isLogout,
    });
  });

  client.on('auth_qr', ({ qr }) => ev.emit('connection.update', { connection: 'connecting', qr }));

  client.on('auth_paired', ({ credentials }) => {
    sock.authState.creds.registered = true;
    if (credentials?.meJid) sock.user = { id: credentials.meJid };
  });

  client.on('message', (event) => {
    const key = event.key ?? {};

    // Panen pemetaan LID <-> nomor. zapo menaruh penomoran alternatif di
    // *Alt: kalau chat/pengirim dialamati sebagai LID, pasangannya adalah
    // nomor telepon (dan sebaliknya).
    lidCache.remember(key.remoteJid, key.remoteJidAlt);
    lidCache.remember(key.remoteJidAlt, key.remoteJid);
    lidCache.remember(key.participant, key.participantAlt);
    lidCache.remember(key.participantAlt, key.participant);

    // Chat yang belum ada di thread store (mis. chat baru) tetap tercatat,
    // supaya `sock.chats` tidak ketinggalan dari kenyataan.
    const jid = key.remoteJid;
    if (jid && !chats[jid]) chats[jid] = { jid, name: event.pushName };

    if (isDevLogEnabled()) {
      devlog('message', {
        key: summarizeKey(key),
        pushName: event.pushName,
        timestampSeconds: event.timestampSeconds,
        // Nama field message menentukan tipe pesan — inilah yang dibaca
        // getContentType() dan jadi dasar semua percabangan di plugin.
        messageTypes: Object.keys(event.message ?? {}),
        text:
          event.message?.conversation ??
          event.message?.extendedTextMessage?.text ??
          event.message?.imageMessage?.caption ??
          event.message?.videoMessage?.caption,
      });
    }

    // `key`, `message`, dan `pushName` milik zapo sudah sebentuk dengan Baileys
    // (termasuk remoteJidAlt/participantAlt), TAPI stempel waktunya bernama
    // `timestampSeconds`, bukan `messageTimestamp`. serializeMessage.js
    // memakai `messageTimestamp` sebagai syarat pertama dan langsung
    // `return null` kalau kosong — tanpa alias ini SETIAP pesan dibuang diam-diam.
    ev.emit('messages.upsert', {
      messages: [{ ...event, messageTimestamp: event.timestampSeconds }],
      type: 'notify',
    });
  });

  // Baileys hanya mengenal empat aksi peserta; zapo memancarkan puluhan aksi
  // grup lain (create, subject, announce, link, …). Kalau semuanya diteruskan,
  // pemakainya membalas "action tidak valid : <aksi>" untuk tiap kejadian.
  const AKSI_PESERTA_BAILEYS = new Set(['add', 'remove', 'promote', 'demote']);

  client.on('group', (event) => {
    if (!event.groupJid || !event.participants?.length) return;

    // Panen pemetaan dilakukan SEBELUM penyaringan aksi: aksi apa pun yang
    // membawa daftar peserta tetap berguna untuk cache LID -> nomor.
    for (const p of event.participants) lidCache.remember(p.lidJid, p.phoneJid);

    if (!AKSI_PESERTA_BAILEYS.has(event.action)) return;

    // `jid` di event zapo OPSIONAL — pada grup ber-alamat LID sering hanya
    // `phoneJid`/`lidJid` yang terisi. Dulu di sini cuma dibaca `p.jid`,
    // sehingga `filter(Boolean)` bisa menyisakan array kosong dan pemakainya
    // membaca `participants[0]` yang undefined (error "reading 'split'").
    // Nomor telepon didahulukan supaya mention menampilkan nomor asli.
    const participants = event.participants
      .map((p) => p.phoneJid ?? p.jid ?? p.lidJid)
      .filter(Boolean);

    if (!participants.length) return;

    ev.emit('group-participants.update', {
      id: event.groupJid,
      author: event.authorJid,
      participants,
      action: event.action,
    });
  });

  client.on('call', (event) => {
    ev.emit('call', [
      {
        id: event.callId,
        // Anticall memblokir penelepon, jadi yang dipakai adalah JID nomor
        // teleponnya; `callCreatorJid` dipakai sebagai cadangan.
        from: event.callerPnJid ?? event.callCreatorJid ?? event.senderLidJid,
        // Baileys memakai 'offer' untuk panggilan masuk; zapo memakai `type`.
        status: event.type,
        isVideo: !!event.isVideo,
        isGroup: !!event.groupJid,
      },
    ]);
  });

  client.on('picture', (event) => {
    if (!event?.jid) return;
    contacts[event.jid] = { ...(contacts[event.jid] ?? {}), id: event.jid };
    ev.emit('contacts.update', [contacts[event.jid]]);
  });
}

/**
 * Rapikan node IQ mentah gaya Baileys sebelum dikirim lewat `lowlevel.query`.
 *
 * Baileys memakai konstanta server grup `"@g.us"` (dengan `@`) dan menaruhnya
 * apa adanya di atribut `to`. zapo memakai `"g.us"`
 * (`WA_DEFAULTS.GROUP_SERVER`). Dengan `@` di depan, JID-nya tidak valid:
 * servernya tidak membalas sama sekali dan query berakhir
 * `query timeout ... after 15000ms` — bukan error yang menjelaskan apa pun.
 *
 * Yang dilakukan cuma membuang `@` di awal `to`; sisanya diteruskan apa adanya.
 */
function normalizeQueryNode(node) {
  const to = node?.attrs?.to;
  if (typeof to !== 'string' || !to.startsWith('@')) return node;

  return { ...node, attrs: { ...node.attrs, to: to.slice(1) } };
}

/** Ukuran foto profil yang dipakai WhatsApp Web. */
const PROFILE_PICTURE_SIZE = 640;

/**
 * Tentukan atribut `target` untuk operasi foto profil.
 *
 * zapo hanya memasang `target=<jid>` kalau argumennya diisi, dan atribut itu
 * berarti "operasi admin GRUP/KOMUNITAS". Untuk foto profil akun sendiri,
 * target harus DIKOSONGKAN — kalau JID akun sendiri ikut dikirim sebagai
 * target, server tidak membalas sama sekali dan permintaannya berakhir
 * `query timeout ... after 15000ms`.
 *
 * Di Baileys satu fungsi `updateProfilePicture(jid, ...)` dipakai untuk
 * keduanya, jadi pemilahannya dilakukan di sini: hanya JID grup yang diteruskan
 * sebagai target.
 */
function profilePictureTarget(jid) {
  return typeof jid === 'string' && jid.endsWith('@g.us') ? jid : undefined;
}

/**
 * Siapkan byte foto profil: JPEG, persegi, resolusi wajar.
 *
 * `setProfilePicture` zapo mengunggah apa adanya, jadi penyesuaian yang dulu
 * dikerjakan Baileys harus dilakukan di sini.
 */
async function toProfilePictureJpeg(bytes) {
  const { Jimp } = await import('jimp');
  const input = Buffer.from(bytes);

  let image;
  try {
    image = await Jimp.read(input);
  } catch (error) {
    // jimp 1.6 tidak bisa membaca WebP. imageNormalizer punya jalur ffmpeg
    // untuk format-format itu.
    const { normalizeImageBuffer } = await import('../imageNormalizer.js');
    const normalized = await normalizeImageBuffer(input);
    image = await Jimp.read(normalized.buffer);
  }

  // `cover` memotong ke persegi tanpa menggepengkan gambar.
  const jpeg = await image
    .cover({ w: PROFILE_PICTURE_SIZE, h: PROFILE_PICTURE_SIZE })
    .getBuffer('image/jpeg');

  return new Uint8Array(jpeg);
}

async function toBytes(source) {
  if (!source) return source;
  if (source instanceof Uint8Array) return source;
  const value = typeof source === 'string' ? source : source.url;
  if (!value) throw new Error('Sumber gambar tidak valid');
  if (/^https?:\/\//i.test(value)) {
    const res = await fetch(value);
    return new Uint8Array(await res.arrayBuffer());
  }
  const { readFile } = await import('fs/promises');
  return new Uint8Array(await readFile(value));
}
