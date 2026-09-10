import { reply } from '../../lib/utils.js';
import config from '../../config.js';

async function handle(sock, messageInfo) {
  const { m } = messageInfo;

  const text = `╭「 Status 」
│
│◧ Versi : ${global.version}
│◧ Destination : ${config.bot_destination}
│◧ Rate Limit : ${config.rate_limit} ms
│◧ Owner : ${config.owner_number.length || 0}
│◧ Mode : ${config.mode}
╰────────────────────────◧`;

  await reply(m, text);
}

export default {
  handle,
  Commands: ['status'],
  OnlyPremium: false,
  OnlyOwner: false,
};
