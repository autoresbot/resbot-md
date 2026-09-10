import { reply } from "../../lib/utils.js";

function loremIpsum(e) {
  let t = isNaN(parseInt(e)) ? 50 : parseInt(e);
  t = Math.min(t, 500);
  const r = [
    "Lorem",
    "ipsum",
    "dolor",
    "sit",
    "amet",
    "consectetur",
    "adipiscing",
    "elit",
    "sed",
    "do",
    "eiusmod",
    "tempor",
    "incididunt",
    "ut",
    "labore",
    "et",
    "dolore",
    "magna",
    "aliqua",
  ];
  let n = "";
  for (let e = 0; e < t; e++)
    n += r[Math.floor(Math.random() * r.length)] + " ";
  return n.trim();
}

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, content } = messageInfo;

  try {
    const data = content ? loremIpsum(content) : loremIpsum(50);
    await reply(m, data);
  } catch (error) {
    console.error("Error saat memproses grup:", error);

    // Kirim pesan kesalahan
    await sock.sendMessage(
      remoteJid,
      { text: "⚠️ Terjadi kesalahan" },
      { quoted: message }
    );
  }
}
export default {
  handle,
  Commands: ["lorem"],
  OnlyPremium: false,
  OnlyOwner: false,
};
