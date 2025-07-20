const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { exec } = require('child_process');

// === Environment Setup ===
const isTermux = false;
const bot = new Telegraf('8038019851:AAFNX7Uwo3hujbkrWU4G_ybn43s0DXe-1xs'); // <-- Insert token
const app = express();
app.use(express.json());
app.use(bot.webhookCallback('/'));
bot.telegram.setWebhook('https://my-bot-tcj8.onrender.com'); // <-- Insert Render URL

// === Logs Setup ===
const logFilePath = path.join(__dirname, 'chat_logs.json');
let chatLogs = [];
if (fs.existsSync(logFilePath)) {
  try {
    chatLogs = JSON.parse(fs.readFileSync(logFilePath));
  } catch {
    chatLogs = [];
  }
}
function saveLogs() {
  fs.writeFileSync(logFilePath, JSON.stringify(chatLogs, null, 2));
}

// === Font Setup ===
const fontFilePath = path.join(__dirname, 'font_config.json');
let currentFont = 'normal';
if (fs.existsSync(fontFilePath)) {
  try {
    currentFont = JSON.parse(fs.readFileSync(fontFilePath)).font;
  } catch {}
}
function saveFont(font) {
  fs.writeFileSync(fontFilePath, JSON.stringify({ font }));
}

const fonts = {
  normal: (t) => t,
  bold: (t) => t.replace(/[A-Za-z]/g, c => String.fromCodePoint(c.charCodeAt(0) + 0x1D400 - (c <= 'Z' ? 0x41 : 0x61))),
  italic: (t) => t.replace(/[A-Za-z]/g, c => String.fromCodePoint(c.charCodeAt(0) + 0x1D434 - (c <= 'Z' ? 0x41 : 0x61))),
  monospace: (t) => t.replace(/[a-z]/g, c => String.fromCodePoint(0x1D68A + c.charCodeAt(0) - 97)),
  double: (t) => t.replace(/[a-z]/g, c => String.fromCodePoint(0x1D4B6 + c.charCodeAt(0) - 97)),
  script: (t) => t.replace(/[a-z]/g, c => String.fromCodePoint(0x1D4EA + c.charCodeAt(0) - 97))
};

function stylize(t) {
  return fonts[currentFont] ? fonts[currentFont](t) : t;
}

// === Admin Setup ===
const ADMINS = [6649936329];
const adminMenuText = '✅ Admin Panel — Choose a command:';
const adminKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('📊 Stats', 'admin_stats')],
  [Markup.button.callback('📁 Download Logs', 'admin_logs')],
  [Markup.button.callback('🗑️ Clear Logs', 'admin_clearlogs')],
  [Markup.button.callback('🖼️ Generate Image', 'gen_image')],
  [Markup.button.callback('🔤 Switch Font', 'font_menu')]
]);

// === Admin Menu Trigger ===
bot.command('admin', (ctx) => {
  if (!ADMINS.includes(ctx.from.id)) return ctx.reply('🚫 You are not authorized.');
  ctx.replyWithMarkdown(adminMenuText, adminKeyboard);
});
bot.hears(/^\/$/, (ctx) => {
  if (!ADMINS.includes(ctx.from.id)) return;
  ctx.replyWithMarkdown(adminMenuText, adminKeyboard);
});

// === Admin Actions ===
bot.action('admin_stats', (ctx) => {
  if (!ADMINS.includes(ctx.from.id)) return ctx.answerCbQuery('🚫 Not authorized.');
  const userIds = new Set(chatLogs.map(log => log.userId));
  const recentChats = chatLogs.slice(-5).map(log => `🗨️ ${log.username}: ${log.message}`).join('\n');
  ctx.replyWithMarkdown(
    `📊 *Bot Stats:*\n👥 Unique Users: ${userIds.size}\n💬 Total Messages: ${chatLogs.length}\n\n📝 *Last 5 Messages:*\n${recentChats || 'None'}`
  );
});

bot.action('admin_logs', (ctx) => {
  if (!ADMINS.includes(ctx.from.id)) return ctx.answerCbQuery('🚫 Not authorized.');
  if (!fs.existsSync(logFilePath)) return ctx.reply('🗃️ No logs found.');
  ctx.replyWithDocument({ source: logFilePath, filename: 'chat_logs.json' });
});

bot.action('admin_clearlogs', (ctx) => {
  if (!ADMINS.includes(ctx.from.id)) return ctx.answerCbQuery('🚫 Not authorized.');
  chatLogs = [];
  saveLogs();
  ctx.reply('🗑️ Chat logs cleared.');
});

// === Image Prompt Generator ===
bot.action('gen_image', async (ctx) => {
  if (!ADMINS.includes(ctx.from.id)) return ctx.answerCbQuery('🚫 Not authorized.');
  await ctx.reply('🖌️ Send a prompt to generate an image:');
  bot.once('text', async (msgCtx) => {
    const prompt = msgCtx.message.text;
    msgCtx.sendChatAction('upload_photo');
    try {
      const res = await axios.get('https://api.giftedtech.co.ke/api/ai/image', {
        params: { apikey: 'gifted', prompt }
      });
      if (res.data.url) {
        await msgCtx.replyWithPhoto(res.data.url, {
          caption: `🖼️ *Generated Image:*\n_${prompt}_`,
          parse_mode: 'Markdown'
        });
      } else {
        msgCtx.reply('❌ Failed to generate image.');
      }
    } catch {
      msgCtx.reply('❌ AI Image API failed.');
    }
  });
});

// === Font Switch Menu ===
bot.action('font_menu', (ctx) => {
  if (!ADMINS.includes(ctx.from.id)) return ctx.answerCbQuery('🚫 Not authorized.');
  const buttons = Object.keys(fonts).map(name => Markup.button.callback(name, `font_${name}`));
  ctx.reply('🔤 Choose font style:', Markup.inlineKeyboard(buttons, { columns: 2 }));
});
bot.action(/font_.+/, (ctx) => {
  if (!ADMINS.includes(ctx.from.id)) return ctx.answerCbQuery('🚫 Not authorized.');
  const font = ctx.match[0].replace('font_', '');
  currentFont = font;
  saveFont(font);
  ctx.editMessageText(`✅ Font switched to *${font}*`, { parse_mode: 'Markdown' });
});

// === Termux Commands ===
if (isTermux) {
  bot.command('battery', (ctx) => {
    exec('termux-battery-status', (err, stdout) => {
      if (err) return ctx.reply('❌ Battery info not available.');
      const info = JSON.parse(stdout);
      ctx.replyWithMarkdown(`🔋 *Battery Info:*\nLevel: ${info.percentage}%\nStatus: ${info.status}`);
    });
  });

  bot.command('device', (ctx) => {
    exec('termux-telephony-deviceinfo', (err, stdout) => {
      if (err) return ctx.reply('❌ Device info not available.');
      ctx.replyWithMarkdown(`📱 *Device Info:*\n\n\`\`\`${stdout}\`\`\``, { parse_mode: 'Markdown' });
    });
  });

  bot.command('location', (ctx) => {
    exec('termux-location', (err, stdout) => {
      if (err) return ctx.reply('❌ Location error.');
      const data = JSON.parse(stdout);
      ctx.reply(`📍 Location:\nLatitude: ${data.latitude}\nLongitude: ${data.longitude}`);
    });
  });
} else {
  bot.command(['battery', 'device', 'location'], (ctx) => {
    ctx.reply('⚠️ This command only works inside Termux.');
  });
}

// === AI Text Fallback Handling ===
const aiEndpoints = [
  'https://api.giftedtech.co.ke/api/ai/gpt4o',
  'https://api.giftedtech.co.ke/api/ai/geminiaipro',
  'https://api.giftedtech.co.ke/api/ai/meta-llama',
  'https://api.giftedtech.co.ke/api/ai/gpt',
  'https://api.giftedtech.co.ke/api/ai/ai'
];

bot.on('text', async (ctx) => {
  await ctx.sendChatAction('typing');
  const userMessage = ctx.message.text;
  const username = ctx.from.username || `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim() || 'Unknown';
  const userId = ctx.from.id;

  let aiReply = "🤖 I couldn't generate a response.";

  for (let url of aiEndpoints) {
    try {
      const res = await axios.get(url, {
        params: { apikey: 'gifted', q: userMessage },
        timeout: 5000
      });
      if (res.data.result) {
        aiReply = res.data.result;
        break;
      }
    } catch {}
  }

  if (aiReply.includes("couldn't")) {
    try {
      const res = await axios.post('https://free.churchless.tech/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: userMessage }]
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      aiReply = res.data.choices?.[0]?.message?.content || aiReply;
    } catch {}
  }

  ctx.reply(stylize(aiReply));
  chatLogs.push({ time: new Date().toISOString(), userId, username, message: userMessage, response: aiReply });
  saveLogs();
});

// === AI Image Vision Handler ===
bot.on('photo', async (ctx) => {
  const fileId = ctx.message.photo.pop().file_id;
  const fileLink = await ctx.telegram.getFileLink(fileId);
  ctx.sendChatAction('typing');

  try {
    const res = await axios.get('https://api.giftedtech.co.ke/api/ai/vision', {
      params: {
        apikey: 'gifted',
        url: fileLink.href,
        prompt: 'Describe in detail what is in the picture, including objects, atmosphere and mood of the picture'
      }
    });
    ctx.reply(stylize(res.data.result || '🖼️ No description returned.'));
  } catch {
    ctx.reply(stylize('⚠️ Failed to describe the image.'));
  }
});

// === Start Server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Bot running on port ${PORT}`));
