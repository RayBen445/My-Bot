const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { exec } = require('child_process');

// === Bot & Express Setup ===
const bot = new Telegraf('8038019851:AAFNX7Uwo3hujbkrWU4G_ybn43s0DXe-1xs'); // ⬅️ Your bot token
const app = express();
app.use(express.json());
app.use(bot.webhookCallback('/'));
bot.telegram.setWebhook('https://my-bot-tcj8.onrender.com'); // ⬅️ Your Render URL

// === Log Setup ===
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

// === Admin IDs ===
const ADMINS = [6649936329]; // ⬅️ Add your Telegram user ID(s) here

// === Welcome Commands ===
bot.start((ctx) => ctx.reply('👋 Welcome! I am your AI bot. Type any question, and I’ll reply!'));
bot.help((ctx) => ctx.reply('💡 Just send me a message and I’ll reply using GiftedTech AI.'));

// === Admin-only Command ===
bot.command('admin', (ctx) => {
  if (!ADMINS.includes(ctx.from.id)) {
    return ctx.reply('🚫 You are not authorized to use this command.');
  }
  ctx.reply('✅ Hello Admin! This is a protected command.');
});

// === Termux Commands ===
bot.command('battery', (ctx) => {
  ctx.sendChatAction('typing');
  exec('termux-battery-status', (err, stdout) => {
    if (err) return ctx.reply('❌ Battery info not available.');
    const info = JSON.parse(stdout);
    ctx.replyWithMarkdown(`🔋 *Battery Info:*\nLevel: ${info.percentage}%\nStatus: ${info.status}`);
  });
});

bot.command('device', (ctx) => {
  exec('termux-telephony-deviceinfo', (err, stdout) => {
    if (err) return ctx.reply('❌ Could not retrieve device info.');
    ctx.replyWithMarkdown(`📱 *Device Info:*\n\`\`\`\n${stdout}\n\`\`\``);
  });
});

bot.command('location', (ctx) => {
  exec('termux-location', (err, stdout) => {
    if (err) return ctx.reply('❌ Location error.');
    const data = JSON.parse(stdout);
    ctx.reply(`📍 Location:\nLatitude: ${data.latitude}\nLongitude: ${data.longitude}`);
  });
});

// === GiftedTech AI Endpoints ===
const aiEndpoints = [
  'https://api.giftedtech.co.ke/api/ai/gpt4o',
  'https://api.giftedtech.co.ke/api/ai/geminiaipro',
  'https://api.giftedtech.co.ke/api/ai/meta-llama',
  'https://api.giftedtech.co.ke/api/ai/gpt',
  'https://api.giftedtech.co.ke/api/ai/ai'
];

// === AI Message Handler with Fallbacks ===
bot.on('text', async (ctx) => {
  await ctx.sendChatAction('typing');
  const userMessage = ctx.message.text;
  const username = ctx.from.username || `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim() || 'Unknown';
  const userId = ctx.from.id;

  let aiReply = "🤖 I couldn't generate a response.";

  // GiftedTech fallback loop
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
    } catch {
      console.warn(`❌ Failed API: ${url}`);
    }
  }

  // Backup: Free OpenAI proxy if all GiftedTech failed
  if (aiReply.includes("couldn't")) {
    try {
      const response = await axios.post('https://free.churchless.tech/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: userMessage }],
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      aiReply = response.data.choices?.[0]?.message?.content || aiReply;
    } catch (err) {
      console.warn('❌ Backup OpenAI proxy also failed.');
    }
  }

  ctx.reply(aiReply);
  chatLogs.push({ time: new Date().toISOString(), userId, username, message: userMessage, response: aiReply });
  saveLogs();
});

// === Image Vision Handler ===
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
    ctx.reply(res.data.result || '🖼️ No description returned.');
  } catch {
    ctx.reply('⚠️ Failed to describe the image.');
  }
});

// === Start Express Server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot running on port ${PORT}`);
});
