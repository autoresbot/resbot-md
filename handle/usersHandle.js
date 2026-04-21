import { registerUser, findUser, updateUser, isOwner } from '../lib/users.js';
import { SLRcheckMessage } from '../lib/slr.js';
import { findGroup, addGroup, isUserBlocked, isFiturBlocked, DEFAULT_FITUR } from '../lib/group.js';
import { logWithTime, warning, logTracking } from '../lib/utils.js';
import mess from '../strings.js';
import { getGroupMetadata } from '../lib/cache.js';

const notifiedUsers = new Set();

async function process(sock, messageInfo) {
  const { remoteJid, sender, senderLid, isGroup, pushName, command, message, mentionedJid } =
    messageInfo;

  if (!senderLid) return true; // Sender tidak valid

  try {
    const selfChecker = await findGroup('owner');
    if (selfChecker && command != 'public') {
      console.log('BOT SEDANG SELF, Ketik .public untuk mengaktifkan bot kembali');
      logWithTime('System', `BOT SEDANG DI SELF`);
      if (isOwner(senderLid)) {
        return true;
      }
      return false;
    }

    // Mencari pengguna
    const user = await findUser(senderLid, 'Debug 5');

    if (isGroup) {
      // cek jika di grup
      const dataGrub = await findGroup(remoteJid);
      if (!dataGrub) {
        // Menambahkan grup jika belum ada
        await addGroup(remoteJid, {
          fitur: { ...DEFAULT_FITUR },
          userBlock: [],
        });
      }

      // cek user ban di grub ini
      const isBaned = await isUserBlocked(remoteJid, senderLid);

      if (isBaned) {
        const notifKey = `ban-${remoteJid}-${senderLid}`;
        if (!notifiedUsers.has(notifKey)) {
          notifiedUsers.add(notifKey);
          logTracking(`User Handler - ban-${remoteJid}-${senderLid}`);
          await sock.sendMessage(remoteJid, { text: mess.general.isBaned }, { quoted: message });
        }

        warning(pushName, `User sedang di ban di grub ini`);
        return false;
      }

      // cek fitur ban di grub ini
      const isBlockFitur = await isFiturBlocked(remoteJid, command);
      if (isBlockFitur) {
        const notifKey = `fiturblocked-${remoteJid}-${command}`;
        if (!notifiedUsers.has(notifKey)) {
          notifiedUsers.add(notifKey);
          logTracking(`User Handler - fiturblocked-${remoteJid}-${command}`);
          await sock.sendMessage(
            remoteJid,
            { text: mess.general.fiturBlocked },
            { quoted: message },
          );
        }

        warning(pushName, `Fitur sedang di ban di grub ini`);
        return false;
      }

      if (mentionedJid?.length > 0) {
        const isSlr = await SLRcheckMessage(remoteJid);
        if (isSlr) {
          const groupMetadata = await getGroupMetadata(sock, remoteJid);
          const participants = groupMetadata.participants;
          const isAdmin = participants.some(
            (participant) => participant.id === mentionedJid[0] && participant.admin,
          );
          if (isAdmin) {
            logTracking(`User Handler - SLR Fitur on`);
            await sock.sendMessage(remoteJid, { text: isSlr }, { quoted: message });
            return;
          }
        }
      }
    }
    if (user) {
      const [docId, userData] = user;

      const status = userData.status;
      if (status === 'block') {
        // user di block
        const notifKey = `block-${senderLid}`;
        if (!notifiedUsers.has(notifKey)) {
          notifiedUsers.add(notifKey); // Tandai sudah diberi notifikasi
          logTracking(`User Handler - block-${senderLid}`);
          await sock.sendMessage(remoteJid, { text: mess.general.isBlocked }, { quoted: message });
        }

        warning(pushName, `User sedang di block`);
        return false;
      }
      // Tambah level_cache, dan jika mencapai batas, naikkan level
      let { level, level_cache } = userData; // Destrukturisasi objek user

      level_cache += 1;

      // Naikkan level jika level_cache melebihi 100
      if (level_cache > 100) {
        level += 1; // Tambah level
        level_cache = 0; // Reset level_cache
      }

      await updateUser(senderLid, { level, level_cache });
    } else {
      try {
        // register otomatis
        const username = `user_${senderLid.toLowerCase()}`;
        const res = registerUser(senderLid, username);
      } catch (error) {
        console.log('GAGAL REGISTER OTOMATIS :', error);
      }
    }

    return true; // Lanjutkan ke plugin berikutnya
  } catch (error) {
    logWithTime('System', `Error dalam proses register`);
    return false; // Jika ada error, hentikan proses
  }
}

export default {
  name: 'Users & Grub Handle',
  priority: 3,
  process,
};
