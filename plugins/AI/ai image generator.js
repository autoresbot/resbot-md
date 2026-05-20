const PROMPTS = {
  tobotak: `
Make the person in this image naturally bald.
Keep the same face, pose, expression, lighting, and background realistic.
`,

  tohijab: `
Add a beautiful white Indonesian style hijab to the person in this image.
Keep the same face, expression, and pose realistic and natural.
`,

  tohitam: `
Make the person's skin darker/black naturally while keeping realistic details.
Keep the same face, pose, clothing, and lighting unchanged.
`,

  tomirror: `
Recreate this image as a mirror selfie taken with an iPhone 17 Pro Max.
The subject should be holding the phone as if taking a photo of themselves in the mirror,
with the phone's flash clearly visible and reflecting off the mirror to create dramatic aesthetic lighting.
Keep the same face, expression, pose, and clothing.
Replace the background with a clean white curtain.
`,

  toanime: `
Transform this image into premium anime style artwork.
Keep the same character, pose, facial expression, hairstyle, and clothing.
Highly detailed, cinematic, vibrant anime aesthetic.
`,

  tocute: `
Make this image look more cute and aesthetic.
Improve lighting, colors, and soft visual appearance while keeping the same person.
`,

  tocyberpunk: `
Transform this image into a futuristic cyberpunk style.
Add neon lighting, futuristic atmosphere, cinematic effects, and cyberpunk city vibes.
`,

  tosketsa: `
Turn this image into a realistic pencil sketch drawing.
Black and white sketch style with detailed hand-drawn lines.
`,

  glitch: `
Apply a cool glitch art effect to this image.
Add RGB distortion, digital noise, and aesthetic glitch effects.
`,

  putihkan: `
Brighten and whiten the skin naturally while keeping realistic details.
Keep the same face and appearance.
`,

  realistic: `
Convert this image into ultra realistic photography style.
Enhance realism, lighting, skin texture, and cinematic details.
`,

  toqinshihuang: `
Transform this character into Qin Shi Huang from Record of Ragnarok.
Keep the same face while adapting the outfit, hairstyle, and king aesthetic.
`,

  watercolor: `
Turn this image into a soft watercolor painting artwork.
Elegant brush strokes and artistic watercolor texture.
`,

  tofigure: `
Transform this photo into a premium 3D collectible figure toy.
Highly detailed figurine style with realistic toy packaging aesthetic.
`,

  samurai: `
Transform this character into a Japanese samurai warrior.
Add traditional samurai outfit, katana, and cinematic Japanese atmosphere.
`,

  removewm: `
Remove all watermark, text, logo, and unwanted objects from the image professionally.
Maintain realistic and clean results.
`,

  cartoon: `
Turn this image into expressive cartoon style artwork.
Colorful cartoon aesthetic with detailed character style.
`,

  pixel: `
Transform this image into retro pixel art style.
Classic 8-bit pixel aesthetic with vibrant colors.
`,

  colors: `
Colorize and enhance the colors of this image beautifully.
Make the image vibrant and visually appealing.
`,

  oilpainting: `
Transform this image into a classical oil painting artwork.
Rich paint texture and elegant artistic style.
`,

  viking: `
Transform this character into a Norse Viking warrior.
Add Viking armor, beard style, snowy atmosphere, and cinematic Nordic aesthetic.
`,
};

import { downloadQuotedMedia, downloadMedia, reply } from '../../lib/utils.js';
import fs from 'fs';
import path from 'path';
import mess from '../../strings.js';
import axios from 'axios';
import ApiAutoresbotModule from 'api-autoresbot';
const ApiAutoresbot = ApiAutoresbotModule.default || ApiAutoresbotModule;
import config from '../../config.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const http = axios.create({
  timeout: 30000,
  validateStatus: () => true,
});

async function handle(sock, messageInfo) {
  const { m, remoteJid, message, prefix, command, type, isQuoted } = messageInfo;

  try {
    const mediaType = isQuoted ? isQuoted.type : type;
    if (mediaType !== 'image') {
      return await reply(m, `⚠️ _Kirim/Balas gambar dengan caption *${prefix + command}*_`);
    }

    await sock.sendMessage(remoteJid, {
      react: { text: '⏰', key: message.key },
    });

    const prompt = PROMPTS[command];

    if (!prompt) {
      return await reply(m, '❌ Prompt tidak ditemukan untuk command ini.');
    }

    // ===============================
    // DOWNLOAD MEDIA (WA SAFE)
    // ===============================
    let media;

    try {
      media = isQuoted ? await downloadQuotedMedia(message) : await downloadMedia(message);
    } catch (err) {
      if (err.code === 'ECONNRESET' || err.message?.includes('terminated')) {
        return await reply(
          m,
          '❌ Gagal mengunduh gambar dari WhatsApp.\n\nSilakan kirim ulang gambar dan coba lagi.',
        );
      }

      throw err;
    }

    const mediaPath = path.join('tmp', media);

    if (!fs.existsSync(mediaPath)) {
      return await reply(m, '❌ File gambar tidak ditemukan.\nSilakan kirim ulang gambar.');
    }

    // ===============================
    // UPLOAD
    // ===============================
    const api = new ApiAutoresbot(config.APIKEY);
    const upload = await api.tmpUpload(mediaPath);

    if (!upload || upload.code !== 200) {
      return await reply(m, '❌ Gagal mengupload gambar.\nSilakan coba beberapa saat lagi.');
    }

    const imageUrl = upload.data.url;

    // ===============================
    // CREATE JOB
    // ===============================

    const createRes = await http.get('https://api.autoresbot.com/api/ai-image', {
      params: { url: imageUrl, prompt: prompt },
      headers: {
        Authorization: `Bearer ${config.APIKEY}`,
      },
    });

    if (!createRes.data?.job_id) {
      return await reply(m, '❌ Gagal memproses gambar.\nSilakan coba lagi.');
    }

    const jobId = createRes.data.job_id;

    // ===============================
    // POLLING
    // ===============================
    const maxRetry = 10;
    const delayMs = 7000;
    let attempt = 0;
    let finalImageUrl = null;

    while (attempt < maxRetry) {
      attempt++;

      try {
        const pollRes = await http.get('https://api.autoresbot.com/api/tools/remini', {
          params: { job_id: jobId },
          headers: {
            Authorization: `Bearer ${config.APIKEY}`,
          },
        });

        const data = pollRes.data;

        if (data.status === 'done') {
          finalImageUrl = data.result;
          break;
        }

        if (data.status === 'failed') {
          return await reply(m, '❌ Proses HD gagal.\nSilakan coba lagi.');
        }
      } catch (pollError) {
        if (pollError.code !== 'ECONNRESET') {
          throw pollError;
        }
      }

      await delay(delayMs);
    }

    if (!finalImageUrl) {
      return await reply(m, '❌ Waktu proses terlalu lama.\nSilakan coba lagi nanti.');
    }

    // ===============================
    // DOWNLOAD FINAL IMAGE
    // ===============================
    const imageRes = await http.get(finalImageUrl, {
      responseType: 'arraybuffer',
    });

    if (imageRes.status !== 200) {
      return await reply(m, '❌ Gagal mengambil hasil gambar.\nSilakan coba lagi.');
    }

    const MediaBuffer = Buffer.from(imageRes.data);

    await sock.sendMessage(
      remoteJid,
      {
        image: MediaBuffer,
        caption: mess.general.success,
      },
      { quoted: message },
    );
  } catch (error) {
    await reply(m, '❌ Terjadi kesalahan saat memproses gambar.\nSilakan coba lagi nanti.');
  }
}

export default {
  handle,
  //Commands: Object.keys(PROMPTS), // otomatis ikut key di prompts di paling atas
  Commands: [
    'tobotak',
    'tohijab',
    'tohitam',
    'tomirror',
    'toanime',
    'tocute',
    'tocyberpunk',
    'tosketsa',
    'glitch',
    'putihkan',
    'realistic',
    'toqinshihuang',
    'watercolor',
    'tofigure',
    'samurai',
    'removewm',
    'cartoon',
    'pixel',
    'colors',
    'oilpainting',
    'viking',
  ],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 1,
};
