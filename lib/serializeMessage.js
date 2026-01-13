import config from '../config.js';
import { removeSpace, isQuotedMessage, getMessageType, getSenderType } from './utils.js';
import { getContentType } from 'baileys';

const debug = true;
const messageMap = new Map();

/* =========================
 * TIME UTILS
 * ========================= */
function time() {
  const now = new Date();
  const jam = now.getHours().toString().padStart(2, '0');
  const menit = now.getMinutes().toString().padStart(2, '0');
  return `${jam}:${menit}`;
}

function logWithTimestamp(...messages) {
  const now = new Date();
  const t = now.toTimeString().split(' ')[0];
  console.log(`[${t}]`, ...messages);
}

/* =========================
 * MAP HANDLER
 * ========================= */
function insertMessage(id, participant, messageTimestamp, remoteId) {
  messageMap.set(id, {
    participant,
    messageTimestamp,
    remoteId,
  });
}

function updateMessagePartial(id, partialData = {}) {
  if (!messageMap.has(id)) {
    console.log(`Data dengan id ${id} tidak ditemukan.`);
    return;
  }
  const current = messageMap.get(id);
  messageMap.set(id, { ...current, ...partialData });
}

/* =========================
 * SERIALIZER (ASLI)
 * ========================= */
function serializeMessage(m, sock) {
  try {
    const rawTimestamp = m?.messages?.[0]?.messageTimestamp;
    const timestamp = Number(rawTimestamp);
    if (!timestamp) return null;

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > 60) return null;

    if (!m || !m.messages || !m.messages[0]) return null;
    if (m.type === 'append') return null;

    const message = m.messages[0];
    const key = message.key || {};

    // console.log(JSON.stringify(message, null, 2));
    // console.log('______________________________');

    let remoteJid = key.remoteJid || key.remoteJidAlt || '';
    const fromMe = key.fromMe || false;
    const id = key.id || '';
    const participant = key.participantAlt || key.participant || message.participant || '';
    const pushName = message.pushName || '';

    const isGroup = remoteJid.endsWith('@g.us');
    const isBroadcast = remoteJid.endsWith('status@broadcast');

    if (!isGroup && !remoteJid.endsWith('@s.whatsapp.net')) {
      remoteJid = key.remoteJidAlt || key.remoteJid;
    }

    let sender = isGroup ? participant : remoteJid;
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

    const isForwarded =
      message.message?.[getContentType(message.message)]?.contextInfo?.isForwarded === true;

    const isBot =
      (id?.startsWith('3EB0') && id.length === 22) ||
      Object.keys(message?.message || {}).some((k) =>
        ['templateMessage', 'interactiveMessage', 'buttonsMessage'].includes(k),
      );

    let antitagsw = Boolean(
      message?.message?.groupStatusMentionMessage ||
        message?.message?.groupStatusMentionMessage?.message?.protocolMessage?.type ===
          'STATUS_MENTION_MESSAGE',
    );

    if (isBroadcast && !antitagsw) {
      console.log('Broadcast message detected, ignoring.');
      return null;
    }

    if (remoteJid === 'status@broadcast' && message?.message?.senderKeyDistributionMessage) {
      antitagsw = true;
      sender = participant;
    }

    let content = '';
    let messageType = '';
    let isTagMeta = false;

    if (message.message) {
      const rawMessageType = getContentType(message.message);
      isTagMeta = rawMessageType === 'botInvokeMessage';

      messageType = Object.keys(message.message)[0];

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
    } else {
      return null;
    }

    content = removeSpace(content || '');

    let command = content.trim().split(' ')[0].toLowerCase();
    const usedPrefix = config.prefix.find((p) => command.startsWith(p));

    command = usedPrefix
      ? command.slice(usedPrefix.length)
      : config.status_prefix
      ? false
      : command;

    const contentWithoutCommand = usedPrefix
      ? content.slice(usedPrefix.length + command.length).trim()
      : content.slice(command.length).trim();

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
      pushName,
      isGroup,
      fromMe,
      remoteJid,
      type: getMessageType(messageType),
      content: contentWithoutCommand,
      message,
      isTagSw: antitagsw,
      prefix: usedPrefix || '',
      command,
      fullText: content,
      isQuoted,
      quotedMessage,
      mentionedJid: message?.message?.extendedTextMessage?.contextInfo?.mentionedJid || false,
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
  } catch (e) {
    return null;
  }
}

export default serializeMessage;
