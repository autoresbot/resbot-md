import config from "../config.js";
import {
  removeSpace,
  isQuotedMessage,
  getMessageType,
  getSenderType,
} from "./utils.js";
import { getContentType } from "baileys";

const debug = true;

// Inisialisasi Map
const messageMap = new Map();

function time() {
  const now = new Date();
  const jam = now.getHours().toString().padStart(2, "0");
  const menit = now.getMinutes().toString().padStart(2, "0");
  return `${jam}:${menit}`;
}

// Fungsi untuk insert data ke dalam Map
function insertMessage(id, participant, messageTimestamp, remoteId) {
  messageMap.set(id, {
    participant,
    messageTimestamp,
    remoteId,
  });
}

function updateMessagePartial(id, partialData = {}) {
  if (messageMap.has(id)) {
    const current = messageMap.get(id);
    messageMap.set(id, { ...current, ...partialData });
  } else {
    console.log(`Data dengan id ${id} tidak ditemukan.`);
  }
}

function logWithTimestamp(...messages) {
  const now = new Date();
  const time = now.toTimeString().split(" ")[0]; // format: HH:MM:SS
  console.log(`[${time}]`, ...messages);
}

function serializeMessage(m, sock) {
  try {
    const timestamp = m.messages?.[0]?.messageTimestamp;
    const now = Math.floor(Date.now() / 1000);
    const diffInSeconds = now - timestamp;

    if (diffInSeconds > 30) {
      return null;
    }

    if (!m || !m.messages || !m.messages[0]) return null;
    if (m.type === "append") return null;

    const message = m.messages[0];

    const key = message.key || {};
    let remoteJid = key.remoteJid || key.remoteJidAlt || "";
    const fromMe = key.fromMe || false;
    const id = key.id || "";
    const participant =
      key.participantAlt || key.participant || message.participant || "";
    const pushName = message.pushName || "";
    const isGroup = remoteJid.endsWith("@g.us");
    const isBroadcast = remoteJid.endsWith("status@broadcast");
    
    if(!isGroup) {
      // kalau bukan whatsapp.net, paksa ambil yang bentuk s.whatsapp.net
      if (!remoteJid.endsWith("@s.whatsapp.net")) {
        remoteJid = key.remoteJidAlt || key.remoteJid
      }
    }
    let sender = isGroup ? participant : remoteJid;
 
    let senderType = getSenderType(sender); // lid user group user-old

    const isQuoted = isQuotedMessage(message); // pesan yang mengutip pesan lain
    const isEdited =
      message?.message?.protocolMessage?.editedMessage?.extendedTextMessage
        ?.text ||
      message?.message?.protocolMessage?.editedMessage?.conversation ||
      message?.message?.editedMessage ||
      null;
    const isDeleted = message?.message?.protocolMessage?.type === 0;
    const isForwarded =
      message.message?.[getContentType(message.message)]?.contextInfo
        ?.isForwarded === true;

    let antitagsw = false;
    let isTagMeta = false;

    // console.log('DARI',sender)
    // console.log(getContentType(message.message))

    let objisEdited = {};
    if (isEdited) {
      const messageId = m.messages[0]?.message?.protocolMessage?.key?.id;
      objisEdited = {
        status: true,
        id: messageId || null,
        text: isEdited,
      };
    }

    const isBot =
      (id?.startsWith("3EB0") && id.length === 22) ||
      (message?.message &&
        Object.keys(message.message).some((key) =>
          ["templateMessage", "interactiveMessage", "buttonsMessage"].includes(
            key
          )
        ));

    antitagsw = !!(
      message?.message?.groupStatusMentionMessage ||
      message?.message?.groupStatusMentionMessage?.message?.protocolMessage
        ?.type === "STATUS_MENTION_MESSAGE"
    );

    if (message?.message?.senderKeyDistributionMessage) {
      //console.log(JSON.stringify(message, null, 2));
      //return;
    }

    if (remoteJid === "status@broadcast") {
      if (message?.message?.senderKeyDistributionMessage) {
        antitagsw = true;
        sender = participant;

        // console.log('--- TAG SW -------')
        // console.log(JSON.stringify(message, null, 2))
        // console.log(`BC SW [${time()} ] ${senderNumber} : ${preview} `)

        // insertMessage(message.key.id, message.key.participant, message.messageTimestamp, null);
        // console.log(`
        //     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //     🚨  TERDETEKSI TAG STORY SW 2!
        //     📅  Waktu       : ${time()}
        //     🆔  Message ID  : ${id}
        //     👤  Pelaku      : ${participant}
        //     📍  Remote JID  : ${remoteJid}
        //     📢  Aksi        : Mengirim story dan kemungkinan menandai anggota grup!
        //     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //     `);
        //console.log(JSON.stringify(message, null, 2))
        // lakukan sesuatu di sini
      }
      //return null;
    }

    let content = "";
    let messageType = "";

    if (message?.message?.stickerMessage) {
      content = "stickerMessage";
    } else {
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
        "";
    }

    if (message.message) {
      const rawMessageType = getContentType(message.message);
      isTagMeta = Boolean(rawMessageType === "botInvokeMessage");

      messageType = Object.keys(message.message)[0]; // imageMessage, pollUpdateMessage, senderKeyDistributionMessage
      content =
        messageType === "conversation"
          ? message.message.conversation
          : messageType === "extendedTextMessage"
          ? message.message.extendedTextMessage.text
          : messageType === "senderKeyDistributionMessage"
          ? message.message.conversation
          : messageType === "imageMessage"
          ? message.message.imageMessage.caption || "No caption"
          : messageType === "videoMessage"
          ? message.message.videoMessage.caption || "No caption"
          : messageType === "stickerMessage"
          ? "stickerMessage"
          : messageType === "audioMessage"
          ? "audioMessage"
          : messageType === "templateButtonReplyMessage"
          ? message.message.templateButtonReplyMessage.selectedId
          : "";

      if (message?.message?.reactionMessage && message?.reaction) {
        // Deteksi reaction
        const emoji = message.reaction?.text || "[REACT DIHAPUS]"; // Bisa kosong jika dihapus
        const reactedToMsgId =
          message.reaction?.key?.id || "[ID TIDAK TERDETEKSI]";
        const reactedBy = message.reaction?.key?.participant || "diri sendiri";
        const groupId =
          message.reaction?.key?.remoteJid || "[GRUP TIDAK TERDETEKSI]";
        const fromMe = message.reaction?.key?.fromMe ?? "[TIDAK DIKETAHUI]";

        messageType = "reactionMessage";
        content = emoji;
      }

      if (message?.message?.reactionMessage) {
        const emoji =
          message.message.reactionMessage?.text || "[REACT DIHAPUS]";

        messageType = "reactionMessage";
        content = emoji;
      }

      if (messageType == "senderKeyDistributionMessage") {
        const text = message.message?.extendedTextMessage?.text;
        if (text) {
          messageType = "conversation";
          content = text;
        }
      }

      if (message.message?.imageMessage?.caption) {
        // detect media
        const caption = message.message.imageMessage.caption;
        messageType = "imageMessage";
        content = caption;
      }

      if (message.message?.stickerMessage) {
        messageType = "stickerMessage";
        content = "stickerMessage";
      }

      if (message.message?.pollResultSnapshotMessage) {
        const pollName = message.message.pollResultSnapshotMessage.name;
        messageType = "pollResultSnapshotMessage";
        content = pollName;
      }

      if (message.message?.senderKeyDistributionMessage && !content) {
        const groupId = message.message.senderKeyDistributionMessage.groupId;
        //console.log("Group ID senderKeyDistributionMessage:", groupId);

        content =
          message?.message?.conversation ||
          message?.message?.extendedTextMessage?.text ||
          message?.message?.imageMessage?.caption ||
          null;

        if (content) {
          messageType = "conversation";
        }

        if (message?.message?.stickerMessage) {
          messageType = "stickerMessage";
          content = "stickerMessage";
        }

        if (message?.message?.videoMessage) {
          const caption = message.message.videoMessage.caption || "";
          messageType = "videoMessage";
          content = caption;
        }

        if (message?.message?.senderKeyDistributionMessage) {
          //console.log('✅ Ini pesan senderKeyDistributionMessage dari grup:', groupId);
          //return null;
        }

        if (message?.message?.protocolMessage?.type === "REVOKE") {
          const revokedMsgInfo = message.message.protocolMessage.key;
          //.log('SINI REVOKE')
        }
      }

      if (message.message?.groupStatusMentionMessage && !content) {
        const groupStatusMentionMessage =
          message?.message?.groupStatusMentionMessage;
        const idTagSw =
          groupStatusMentionMessage?.message?.protocolMessage?.key?.id;
        if (idTagSw) {
          const data = messageMap.get(idTagSw);

          if (data) {
            updateMessagePartial(idTagSw, {
              remoteId: remoteJid,
            });
          }
        }
      }

      if (message.message?.imageMessage && !content) {
        messageType = "imageMessage";
        const caption = message.message.imageMessage.caption || null;
        if (caption) {
          content = caption;
        }
      }

      if (message.message?.extendedTextMessage && !content) {
        const extendedTextMessage = message.message.extendedTextMessage;
        const text = extendedTextMessage.text;
        messageType = "extendedTextMessage";
        content = text;
      }

      if (messageType === "messageContextInfo") {
        messageType = "pollCreationMessage";
        const msg = message.message;
        if (
          msg &&
          msg.pollCreationMessageV3 &&
          msg.pollCreationMessageV3.name
        ) {
          const name = msg.pollCreationMessageV3.name;
          content = name;
        }
      }

      if (message.message?.protocolMessage?.type === 0) {
        const deletedMessageId = message.message.protocolMessage.key.id;
        const deletedBy = message.message.protocolMessage.key.participant;
        const groupId = message.message.protocolMessage.key.remoteJid;
      }

      if (message.message?.viewOnceMessage) {
        const innerMsg = message.message?.viewOnceMessage?.message;

        if (innerMsg?.buttonsMessage?.documentMessage?.caption) {
          const caption = innerMsg.buttonsMessage.documentMessage.caption;
          messageType = "viewOnceMessage";
          content = caption;
        }
      }

      if (message.message?.senderKeyDistributionMessage && !content) {
        const groupId = message.message.senderKeyDistributionMessage.groupId;
        // console.log('✅ Ini pesan senderKeyDistributionMessage dari grup:', groupId);
        //return null;
      }

      const editedMessage =
        message.message?.editedMessage ||
        message.message?.protocolMessage?.editedMessage;
      const editedType = message.message?.protocolMessage?.type === 14;

      if (editedMessage || editedType) {
        const directEdit = editedMessage?.message;

        if (directEdit) {
          return null;
        }

        if (editedMessage?.conversation) {
        } else if (editedMessage?.extendedTextMessage?.text) {
        } else if (editedMessage?.imageMessage?.caption) {
        } else {
        }
      }

      if (message.message?.pollUpdateMessage) {
        console.log("✅ Ini adalah pesan pembaruan polling.");
        return null;
      }

      if (message?.message?.albumMessage) {
        const album = message.message.albumMessage;
        const imageCount = album.expectedImageCount || 0;
        const videoCount = album.expectedVideoCount || 0;
        messageType = "albumMessage";
      }

      if (
        message.message &&
        message.message.buttonsMessage &&
        message.message.buttonsMessage.contentText
      ) {
        const isiPesan = message.message.buttonsMessage.contentText;
        messageType = "buttonsMessage";
        content = isiPesan;
      }

      if (messageType === "viewOnceMessage") {
        const contentText =
          message.message?.viewOnceMessage?.message?.buttonsMessage
            ?.contentText;
        if (contentText) {
          messageType = "viewOnceMessage";
          content = contentText;
        }
      }

      const editedText =
        message.message?.protocolMessage?.type === 14
          ? message.message?.protocolMessage?.editedMessage?.conversation
          : null;
      if (editedText) {
        messageType = "editedMessage";
        content = editedText;
      }

      const pinMessage = message.message?.pinInChatMessage; // Jika pesan di pin
      if (pinMessage) {
        const pinnedMsgId = pinMessage.key?.id;
        const groupId = pinMessage.key?.remoteJid;
        const fromMe = pinMessage.key?.fromMe;
        const timestamp = pinMessage.senderTimestampMs;
        messageType = "pinInChatMessage";
        content = "";
        return null;
      }

      if (message.message?.documentMessage) {
        const doc = message.message.documentMessage;
        const namaFile = doc.fileName || "Tidak diketahui";
        const mime = doc.mimetype || "unknown";
        const url = doc.url;

        messageType = "documentMessage";
        content = namaFile;
      }

      if (!content) {
        // console.log('392 --- NO CONTENT -------')
        // console.log(JSON.stringify(message, null, 2))
        //return null;
      }
    } else {
      //console.log('message.message null!')
      //console.log(JSON.stringify(m, null, 2));
      return null;
    }

    content = removeSpace(content) || "";
    let command = content?.trim()?.split(" ")[0]?.toLowerCase() || "";
    const usedPrefix = config.prefix.find((p) => (command || "").startsWith(p));
    command = usedPrefix
      ? (command || "").slice(usedPrefix.length).trim().split(/\s+/)[0] || ""
      : config.status_prefix
      ? false
      : (command || "").trim().split(/\s+/)[0] || "";

    const contentWithoutCommand = usedPrefix
      ? (content || "")
          .trim()
          .slice(usedPrefix.length + (command?.length || 0))
          .trim()
      : (content || "")
          .trim()
          .slice(command?.length || 0)
          .trim();

    /* ---- Struktur lengkap informasi pesan --- */
    const quotedMessage = isQuoted
      ? {
          text:
            message.message.extendedTextMessage.contextInfo.quotedMessage
              ?.conversation || "",
          sender:
            message.message.extendedTextMessage.contextInfo.participant || "",
          id: message.message.extendedTextMessage.contextInfo.stanzaId || "",
        }
      : null;

    const ArraymentionedJid =
      message?.message?.extendedTextMessage?.contextInfo?.mentionedJid || false;
    const cleanContent = content.replace(/\s+/g, " ").trim(); // Hapus newline/tab jadi spasi
    const preview =
      cleanContent.length > 20
        ? cleanContent.slice(0, 20) + "..."
        : cleanContent;
    const senderNumber = participant.replace(/@s\.whatsapp\.net$/, "");

    if (content) {
      //             console.log(`
      // ╭──────────────────────────────────────╮
      // │ 📅  Time     : ${time()}
      // │ 👤  Sender   : ${senderNumber}
      // │ 📝  PushName : ${pushName}
      // │ 🔍  Preview  :  ${preview}
      // ╰──────────────────────────────────────╯
      //                 `);
      // if(!senderNumber) {
      //     return;
      // }
    }

    if (message?.message?.protocolMessage?.type === 17) {
      return;
    }

    if (messageType == "senderKeyDistributionMessage" && !content) {
      return null;
    }

    if (!content) {
      // console.log('-------[ TIDAK ADA CONTENT ] : ', messageType)
      const ignoredTypes = [
        "senderKeyDistributionMessage",
        "albumMessage",
        "imageMessage",
        "videoMessage",
        "messageContextInfo",
      ];
      if (!ignoredTypes.includes(messageType)) {
        // logWithTimestamp('--- NO CONTENT OPEN ----');
        // logWithTimestamp('--- messageType :', messageType);
        // logWithTimestamp('---- ISI NYA :', message.message);
        // logWithTimestamp('--- NO CONTENT CLOSE ----');
        // console.log(JSON.stringify(m, null, 2));
        // console.log('-------------')
        // kode di sini
      }
    }

    return {
      id,
      timestamp: message.messageTimestamp,
      sender,
      pushName,
      isGroup,
      fromMe,
      remoteJid,
      type: getMessageType(messageType),
      content: contentWithoutCommand,
      message,
      isTagSw: antitagsw,
      prefix: usedPrefix ? usedPrefix : "",
      command,
      fullText: content,
      isQuoted,
      quotedMessage,
      mentionedJid: ArraymentionedJid,
      isBot,
      isTagMeta,
      isForwarded,
      senderType,
      m: { remoteJid, key, message, sock, isDeleted, isEdited: objisEdited, m },
    };
  } catch (e) {
    // console.log('----------------------- error A OPEN ')
    // console.log('error A', e)
    // console.log('----------------------- error A CLOSE ')
    return null;
  }
}

export default serializeMessage;
