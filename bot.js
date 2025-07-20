const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { exec } = require('child_process');

const bot = new Telegraf('8038019851:AAFNX7Uwo3hujbkrWU4G_ybn43s0DXe-1xs');
const app = express();
app.use(express.json());
app.use(bot.webhookCallback('/'));

bot.telegram.setWebhook('https://my-bot-tcj8.onrender.com');

// Log file setup
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

// Start & Help
bot.start((ctx) => {
  ctx.reply('👋 Welcome! I am your AI bot. Type any question, and I’ll reply!');
});
bot.help((ctx) => {
  ctx.reply('💡 Just send me a message and I’ll reply using GiftedTech AI.');
});

// Battery command
bot.command('battery', (ctx) => {
  ctx.sendChatAction('typing');
  exec('termux-battery-status', (err, stdout) => {
    if (err) return ctx.reply('❌ Battery info not available.');
    const info = JSON.parse(stdout);
    ctx.replyWithMarkdown(`🔋 *Battery Info:*\nLevel: ${info.percentage}%\nStatus: ${info.status}`);
  });
});

// Device info
bot.command('device', (ctx) => {
  exec('termux-telephony-deviceinfo', (err, stdout) => {
    if (err) return ctx.reply('❌ Could not retrieve device info.');
    ctx.replyWithMarkdown(`📱 *Device Info:*\n\`\`\`\n${stdout}\n\`\`\``);
  });
});

// Location info
bot.command('location', (ctx) => {
  exec('termux-location', (err, stdout) => {
    if (err) return ctx.reply('❌ Location error.');
    const data = JSON.parse(stdout);
    ctx.reply(`📍 Location:\nLatitude: ${data.latitude}\nLongitude: ${data.longitude}`);
  });
});

// Text message handler
bot.on('text', async (ctx) => {
  try {
    await ctx.sendChatAction('typing');
    const userMessage = ctx.message.text;
    const username = ctx.from.username || `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim() || 'Unknown';
    const userId = ctx.from.id;

    const res = await axios.get('https://api.giftedtech.co.ke/api/ai/openai', {
      params: { apikey: 'gifted', q: userMessage }
    });
    
    const aiReply = response.data.result || "🤖 I couldn't generate a response.";
    ctx.reply(aiReply);

    // Save logs
    chatLogs.push({ time: new Date().toISOString(), userId, username, message: userMessage, response: aiReply });
    saveLogs();
  } catch (err) {
    console.error(err.message);
    ctx.reply('⚠️ Something went wrong. Please try again.');
  }
});

// Start Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot running on port ${PORT}`);
});1
