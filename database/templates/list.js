function applyTemplate(templateIndex, data) {
  const templates = [
    {
      name: "Template 1",
      isUppercase: true, // Huruf kapital?
      sortList: true, // Diurutkan dari abjad
      orderNumber: false, // Tambahkan Nomor urut
      prefixSymbol: "𐚁๋࣭⭑ ",
      data: `「 𝗟𝗜𝗦𝗧 𝗠𝗘𝗡𝗨 𝗦𝗧𝗢𝗥𝗘 」
ᯤ.﹀﹀﹀﹀﹀﹀﹀﹀﹀.ᯤ
⊱┊ *Holla Kak*  @name
⊱┊ *Selamat @greeting 🌝*
⊱┊ *Tanggal : @date*
⊱┊ *Jam : @time*
        ﹉﹉﹉﹉﹉﹉﹉﹉
@list

⋆ 𝙍u𝙡e𝙨 *@group*
ⓘ 𝙠e𝙩i𝙠 𝙣a𝙢a 𝙡a𝙮a𝙣a𝙣 𝙙ia𝙩a𝙨
ⓘ 𝙙i𝙡a𝙧a𝙣g 𝙨p𝙖m 𝙗o𝙩
ⓘ 𝙩r𝙖n𝙨a𝙠s𝙞 𝙝a𝙣y𝙖 𝙠e𝙥a𝙙a 𝙖d𝙢i𝙣 𝙜r𝙤u𝙥 *!*
ⓘ 𝙨e𝙬a 𝙗o𝙩 𝙠e𝙩i𝙠 .𝙤w𝙣e𝙧`,
    },
    {
      name: "Template 2",
      isUppercase: true, // Huruf kapital?
      sortList: true, // Diurutkan dari abjad
      orderNumber: false, // Tambahkan Nomor urut
      prefixSymbol: "- ",
      data: `Halo @name

Selamat Datang di grub @group

📆 Tanggal : @date
⏰ Jam     : @time

╭✄┈ BERIKUT DAFTAR LIST🍧
@list
╰──────────◇
Untuk Melihat List menu
Ketik *teks* di atas`,
    },
    {
      name: "Template 3",
      isUppercase: true, // Huruf kapital?
      sortList: true, // Diurutkan dari abjad
      orderNumber: true, // Tambahkan Nomor urut
      prefixSymbol: "┊⫹⫺",
      data: `Halo @name

Berikut Daftar List
╭═┅═━––––––❍
@list
╰═┅═━––––––❍`,
    },

    {
      name: "Template 4",
      isUppercase: true, // Huruf kapital?
      sortList: true, // Diurutkan dari abjad
      orderNumber: false, // Tambahkan Nomor urut
      prefixSymbol: "┃ 𖥻 ",
      data: `말차, • ──, 𝗁𝖺𝗅𝗈𝗈 @name nama ﹗𝗄𝖾𝗍𝗂𝗄 𝗅𝗂𝗌𝗍 𝖽𝗂𝖻𝖺𝗐𝖺𝗁 𝗂𝗇𝗂 𝗎𝗇𝗍𝗎𝗄 𝗆𝖾𝗇𝖺𝗆𝗉𝗂𝗅𝗄𝖺𝗇 𝖺𝗅𝗅 𝗉𝗋𝗈𝖽𝗎𝖼𝗍 ꒱ 🧺 𝅄   .

🎀 ⸼ 𝗱𝗮𝘁𝗲  ꧇ @date

╭  ❝ 🏷️ 𝗰𝗮𝘁𝗮𝗹𝗼𝗴𝘂𝗲 사랑
@list
╰    ┄─ׅ─ ─  ʚ⃘ɞ  ─ ─ׅ─┄ 


 🛒  𝅃 𝗻𝗼𝘁𝗲  ..
 𝗍𝗋𝖺𝗇𝗌𝖺𝗄𝗌𝗂 𝗁𝖺𝗇𝗒𝖺 𝗆𝖾𝗅𝖺𝗅𝗎𝗂 𝖺𝖽𝗆𝗂𝗇 ,
 𝗇𝗈 𝗌𝗉𝖺𝗆 𝖻𝗈𝗍 ,
 𝗈𝗋𝖽𝖾𝗋 𝗉𝖺𝗍𝗎𝗁𝗂 𝗌𝗇𝗄 𝗒𝗀 𝖻𝖾𝗋𝗅𝖺𝗄𝗎 .`,
    },

    {
      name: "Template 5",
      isUppercase: true, // Huruf kapital?
      sortList: true, // Diurutkan dari abjad
      orderNumber: false, // Tambahkan Nomor urut
      prefixSymbol: "┆ 𐙚 ",
      data: `𝗵𝗮𝗶𝗶𝗶 @name Ꮺ  . . 

❲ 🎀   아름다움 ❳  ..  ‣ 𝗹𝗶𝘀𝘁 " :
╭──────────── ʚɞ  ⸼──╮ 
@list
╰── ʚɞ  ⸼────────────╯

| " .. 비엘   ▸   𝗻𝗼𝘁𝗲 📋 : 
> 𝖺𝗅𝗅 𝗍𝗋𝖺𝗇𝗌𝖺𝗄𝗌𝗂 𝗈𝗇𝗅𝗒 𝗄𝖾 admin
> 𝗄𝖾𝗍𝗂𝗄 𝗽𝗮𝘆 𝗎𝗇𝗍𝗎k 𝗉𝖾𝗆𝖻𝖺𝗒𝖺𝗋𝖺𝗇
> 𝖺𝖽𝗆𝗂𝗇 𝗃𝗎𝗀𝖺 𝗆𝖺𝗇𝗎𝗌𝗂𝖺 𝗁𝖺𝗋𝖺𝗉 𝖻𝖾𝗋𝗌𝖺𝖻𝖺𝗋.`,
    },

    {
      name: "Template 6",
      isUppercase: true, // Huruf kapital?
      sortList: true, // Diurutkan dari abjad
      orderNumber: false, // Tambahkan Nomor urut
      prefixSymbol: "📝 ",
      data: `❋々┈–––┈–––┈⳹
Hi kak @name Selamat @greeting 🌚🏙️ , Selamat datang di *@group* pada pukul _@time_ .🫣

💥 𝘚𝘪𝘭𝘢𝘩𝘬𝘢𝘯 𝘬𝘦𝘵𝘪𝘬 𝘱𝘳𝘰𝘥𝘶𝘬 𝘺𝘢𝘯𝘨 𝘵𝘦𝘳𝘴𝘦𝘥𝘪𝘢 𝘥𝘪 𝘣𝘢𝘸𝘢𝘩 𝘪𝘯𝘪. 🐣
@list

┈–––┈–––┈⳹`,
    },

    {
      name: "Template 7",
      isUppercase: true, // Huruf kapital?
      sortList: true, // Diurutkan dari abjad
      orderNumber: false, // Tambahkan Nomor urut
      prefixSymbol: "»",
      data: `Hari @day
*⬇️ List Menu ⬇️*

@list

Untuk Melihat List menu
Ketik *teks* di atas`,
    },

    {
      name: "Template 8",
      isUppercase: true, // Huruf kapital?
      sortList: true, // Diurutkan dari abjad
      orderNumber: false, // Tambahkan Nomor urut
      prefixSymbol: "◧",
      data: `@greeting kak @name

*DAFTAR LIST*
@list

_Untuk Melihat List menu_
_Ketik *teks* di atas_`,
    },

    {
      name: "Template 9",
      isUppercase: true, // Huruf kapital?
      sortList: true, // Diurutkan dari abjad
      orderNumber: false, // Tambahkan Nomor urut
      prefixSymbol: "┊┊ ׁ𔘓 ࣪.",
      data: `╭╮━━━━━━━━━━━━━━━━━━━┓
┆┊.   ︶꒷꒦︶ ๋࣭ ⭑ ꒰ᐢ. .ᐢ꒱ ⭑. ๋ ︶꒷꒦︶ 
┆┊.           𝐃𝐀𝐅𝐓𝐀𝐑 𝐌𝐄𝐍𝐔
┆┊          ︶︶︶  ୨୧  ︶︶︶ 
┆┆៶៲៸ ֹ  ִ selamat @greeting kak @name 
┆┆៶៲៸ ֹ  ִ @date 
┆┆៶៲៸ ֹ  ִ @time 
┆┆.   ︶꒷꒦︶ ๋࣭ ⭑ ꒰ᐢ. .ᐢ꒱ ⭑. ๋ ︶꒷꒦︶
┆╰─── • ┈ ┈ ୨♡୧  ┈ ┈ • ───͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏͏

┊╭━━━━━━━━━━━━━━━━━━━┓
@list
┊╰─── • ┈ ┈ ୨♡୧  ┈ ┈ • ───
╰━━━━━━━━━━━━━━━━━━━━┛
𝒔𝒊𝒍𝒂𝒉𝒌𝒂𝒏 𝒌𝒆𝒕𝒊𝒌 𝒏𝒐𝒎𝒐𝒓 𝒅𝒂𝒏 𝒏𝒂𝒎𝒂 𝒑𝒓𝒐𝒅𝒖𝒌 𝒚𝒂𝒏𝒈
𝒌𝒂𝒍𝒊𝒂𝒏 𝒄𝒂𝒓𝒊. 𝒋𝒊𝒌𝒂 𝒎𝒆𝒏𝒄𝒂𝒓𝒊 𝒑𝒓𝒐𝒅𝒖𝒌𝒍𝒂𝒊𝒏𝒏𝒚𝒂 𝒃𝒊𝒔𝒂 𝒄𝒉𝒂𝒕 𝒂𝒅𝒎𝒊𝒏 𝒕𝒆𝒓𝒊𝒎𝒂𝒌𝒂𝒄𝒊𝒊𝒊𝒊  ദ്ദി(˵ •̀ ᴗ - ˵ ) ✧`,
    },

    {
      name: "Template Custom",
      isUppercase: true, // Huruf kapital?
      sortList: true, // Diurutkan dari abjad
      orderNumber: false, // Tambahkan Nomor urut
      prefixSymbol: "☍",
      data: `_*VARIABLE YANG TERSEDIA*_
☍ name : @name

☍ date : @date

☍ day : @day

☍ group : @group

☍ greeting : @greeting

☍ size : @size

☍ time : @time

☍ desc : @desc
`,
    },
  ];

  const selectedTemplate = templates[templateIndex - 1]; // Mengambil template berdasarkan indeks (dimulai dari 1)
  let list = data.list; // [ 'jokowi', 'prabowo', 'anjong', 'zebra' ]

  if (selectedTemplate.sortList) {
    // Disalin dulu: `.sort()` mengurutkan array ASLINYA. Dulu tanpa salinan
    // ini `data.list` milik pemanggil ikut berubah urutannya, sehingga nomor
    // list yang dipakai setelah template dibuat tidak lagi cocok dengan
    // urutan penyimpanan aslinya.
    list = [...list].sort();
  }

  if (selectedTemplate.isUppercase) {
    list = list.map((item) => item.toUpperCase()); // Mengubah setiap elemen menjadi huruf kapital
  }
  list = list
    .map((item, index) => {
      const order = selectedTemplate.orderNumber ? `${index + 1}. ` : "";
      const prefix = selectedTemplate.prefixSymbol
        ? `${selectedTemplate.prefixSymbol} `
        : "";
      return `${prefix}${order}${item}`;
    })
    .join("\n");

  return selectedTemplate.data
    .replace(/@name/g, data.name)
    .replace(/@date/g, data.date)
    .replace(/@day/g, data.day)
    .replace(/@desc/g, data.desc)
    .replace(/@group/g, data.group)
    .replace(/@greeting/g, data.greeting)
    .replace(/@size/g, data.size)
    .replace(/@time/g, data.time)
    .replace(/@list/g, list);
}

export { applyTemplate };
