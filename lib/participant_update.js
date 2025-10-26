import { checkMessage } from "./participants.js";
const ApiAutoresbot = await import("api-autoresbot").then(
  (mod) => mod.default || mod
);
import axios from "axios";
import config from "../config.js";
import {
  logWithTime,
  getCurrentDate,
  sendMessageWithMentionNotQuoted,
  sendImagesWithMentionNotQuoted,
  getCurrentTime,
  getGreeting,
  getHari,
  logTracking,
  getSenderType,
} from "./utils.js";
import { getGroupMetadata, getProfilePictureUrl } from "./cache.js";
import { findGroup } from "./group.js";
import { updateUser, findUser } from "./users.js";

async function getWelcomeBuffer(api, type, options) {
  const endpoints = {
    1: "/api/maker/welcome1",
    2: "/api/maker/welcome2",
    3: "/api/maker/welcome3",
    4: "/api/maker/welcome4",
    5: "/api/maker/welcome5",
    6: "/api/maker/welcome6",
    7: "/api/maker/welcome7",
  };

  const url = "https://api.autoresbot.com";
  const endpoint = endpoints[type];
  if (!endpoint) return null;

  try {
    const response = await axios.post(`${url}${endpoint}`, options, {
      responseType: "arraybuffer", // Mengembalikan data sebagai buffer
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error("Error fetching welcome buffer:", error.message);
    return null;
  }
}

async function handleDetectBlackList(sock, remoteJid, sender) {
  try {
    const statusJid = getSenderType(sender);
    // Ambil data grup dari database
    const dataGroupSettings = await findGroup(remoteJid);
    if (!dataGroupSettings) return true;

    const { fitur } = dataGroupSettings;
    if (!fitur.detectblacklist && !fitur.detectblacklist2) return true;

    const user = await findUser(sender);
    if (!user) return true;

    const [docId, userData] = user;

    if (userData.status === "blacklist") {
      if (fitur.detectblacklist) {
        const warningMessage = `⚠️ _Peringatan Blacklist_\n\n@${
          sender.split("@")[0]
        } telah di blacklist.`;
        logTracking(`Participant Update - Peringatan Blacklist (${sender})`);
        await sendMessageWithMentionNotQuoted(
          sock,
          remoteJid,
          warningMessage,
          statusJid
        );
      }

      if (fitur.detectblacklist2) {
        logTracking(
          `Participant Update - Peringatan Blacklist2 di kick (${sender})`
        );
        await sock.groupParticipantsUpdate(remoteJid, [sender], "remove");
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error("Error handling blacklist detection:", error);
    return true;
  }
}

async function handleActiveFeatures(sock, messageInfo, settingGroups) {
  const { id, action, participants, store } = messageInfo;

  if (!id || !action || !participants || participants.length === 0) {
    console.error("Invalid message information provided");
    return;
  }

  const {
    promote = false,
    demote = false,
    welcome = false,
    left = false,
  } = settingGroups;

  // ✅ Ambil targetNumber secara aman dari object participant
  const participant = participants[0];
  const targetNumber =
    participant?.phoneNumber || participant?.id || participant;
  const cleanNumber =
    typeof targetNumber === "string" ? targetNumber.split("@")[0] : "unknown";
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
    logWithTime("SYSTEM", `Fitur ${action} tidak aktif`);
    return;
  }

  const result = await checkMessage(id, action);
  if (!result) return;

  // ✅ Ambil template welcome
  let typeWelcome;
  const templatewelcome = await checkMessage(id, "templatewelcome");
  typeWelcome = templatewelcome || config.typewelcome;

  const groupMetadata = await getGroupMetadata(sock, id);
  if (!groupMetadata) {
    console.error("Failed to fetch group metadata");
    return;
  }

  // ✅ Ambil foto profil dengan fallback aman
  const ppUser = await getProfilePictureUrl(sock, targetNumber);
  const ppGroup = await getProfilePictureUrl(sock, id);
  const contact = store.contacts[targetNumber];

  const pushName =
    contact?.verifiedName ||
    contact?.notify ||
    (typeof targetNumber === "string" ? cleanNumber : "Unknown");

  const { subject, desc, size } = groupMetadata;
  const date = getCurrentDate();
  const time = getCurrentTime();
  const greeting = getGreeting();
  const day = getHari();

  // ✅ Ganti placeholder di template
  const replacements = {
    "@name": targetMention,
    "@date": date,
    "@day": day,
    "@desc": desc,
    "@group": subject,
    "@greeting": greeting,
    "@size": size,
    "@time": time,
  };

  let customizedMessage = result;
  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(key.replace(/@/, "@"), "gi");
    customizedMessage = customizedMessage.replace(regex, value);
  }

  // ✅ Kirim pesan untuk promote/demote/remove
  if (["promote", "demote", "remove"].includes(action)) {
    if (actions[action]) {
      logTracking(`Participant Update - Send text ke (${id})`);
      await sendMessageWithMentionNotQuoted(
        sock,
        id,
        customizedMessage,
        statusJid
      );
    }
    return;
  }

  // ✅ Kirim pesan untuk add/welcome
  if (action === "add" && welcome) {
    if (typeWelcome === "random") {
      const randomTypes = ["1", "2", "3", "4", "5", "6", "text"];
      typeWelcome = randomTypes[Math.floor(Math.random() * randomTypes.length)];
    }

    if (typeWelcome === "text") {
      logTracking(`Participant Update - Send text ke (${id})`);
      await sendMessageWithMentionNotQuoted(
        sock,
        id,
        customizedMessage,
        statusJid
      );
      return;
    }

    const buffer = await getWelcomeBuffer(api, typeWelcome, {
      pp: ppUser,
      name: pushName,
      gcname: subject,
      member: size,
      ppgc: ppGroup,
      desk: desc,
      bg: config.bgwelcome2,
    });

    if (buffer) {
      logTracking(`Participant Update - Send Image ke (${id})`);
      await sendImagesWithMentionNotQuoted(
        sock,
        id,
        buffer,
        customizedMessage,
        statusJid
      );
    } else {
      console.warn("Unhandled typewelcome or missing buffer");
    }
  }
}


export { handleActiveFeatures };
