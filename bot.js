// 🚀 Full Telegram Bot with Admin Panel, Games, Font Switcher, AI Tools
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const express = require('express');
const os = require('os');

const isTermux = false;
const bot = new Telegraf('8038019851:AAFNX7Uwo3hujbkrWU4G_ybn43s0DXe-1xs');
const app = express();
app.use(express.json());
app.use(bot.webhookCallback('/'));
bot.telegram.setWebhook('https://my-bot-tcj8.onrender.com');

const ADMINS = [6649936329];
const adminOnly = (ctx) => ADMINS.includes(ctx.from.id);

// === File Paths ===
const logFilePath = path.join(__dirname, 'chat_logs.json');
const fontFilePath = path.join(__dirname, 'font_config.json');

let chatLogs = fs.existsSync(logFilePath) ? JSON.parse(fs.readFileSync(logFilePath)) : [];
const saveLogs = () => fs.writeFileSync(logFilePath, JSON.stringify(chatLogs, null, 2));

let currentFont = fs.existsSync(fontFilePath) ? JSON.parse(fs.readFileSync(fontFilePath)).font : 'normal';
const saveFont = (font) => fs.writeFileSync(fontFilePath, JSON.stringify({ font }));

const fonts = {
  normal: (t) => t,
  bold: (t) => t.replace(/[A-Za-z]/g, c => String.fromCodePoint(c.charCodeAt(0) + 0x1D400 - (c <= 'Z' ? 0x41 : 0x61))),
  italic: (t) => t.replace(/[A-Za-z]/g, c => String.fromCodePoint(c.charCodeAt(0) + 0x1D434 - (c <= 'Z' ? 0x41 : 0x61))),
  monospace: (t) => t.replace(/[a-z]/g, c => String.fromCodePoint(0x1D68A + c.charCodeAt(0) - 97)),
  double: (t) => t.replace(/[a-z]/g, c => String.fromCodePoint(0x1D4B6 + c.charCodeAt(0) - 97)),
  script: (t) => t.replace(/[a-z]/g, c => String.fromCodePoint(0x1D4EA + c.charCodeAt(0) - 97))
};

const stylize = (t) => fonts[currentFont] ? fonts[currentFont](t) : t;

const adminPanel = Markup.inlineKeyboard([
  [Markup.button.callback('📊 Stats', 'admin_stats')],
  [Markup.button.callback('📢 Broadcast', 'admin_broadcast')],
  [Markup.button.callback('🔤 Font Style', 'font_menu')],
  [Markup.button.callback('👤 My Profile', 'my_profile')],
  [Markup.button.callback('🧩 Riddle Game', 'game_riddle')],
  [Markup.button.callback('🎲 Dice Game', 'game_dice')],
  [Markup.button.callback('📚 Wikipedia', 'wiki')],
  [Markup.button.callback('🧠 Summarize', 'summarize')],
  [Markup.button.callback('🧾 JSON Viewer', 'json_view')],
  [Markup.button.callback('🧮 JS Eval', 'eval_code')],
  [Markup.button.callback('🕓 Uptime', 'uptime')]
], { columns: 2 });

bot.command('admin', ctx => {
  if (!adminOnly(ctx)) return ctx.reply('🚫 Unauthorized');
  ctx.reply('🔧 Admin Panel', adminPanel);
});

bot.action('admin_stats', ctx => {
  if (!adminOnly(ctx)) return ctx.answerCbQuery('🚫');
  const users = [...new Set(chatLogs.map(log => log.userId))];
  const list = users.map(id => `- ⁣[⁣](tg://user?id=${id}) ⁣${id}`).join('\n');
  ctx.reply(`📊 Users (${users.length}):\n${list}`);
});

bot.action('admin_broadcast', ctx => {
  if (!adminOnly(ctx)) return ctx.answerCbQuery('🚫');
  ctx.reply('📢 Send the broadcast text:');
  bot.once('text', async (msgCtx) => {
    const msg = stylize(msgCtx.message.text);
    const users = [...new Set(chatLogs.map(l => l.userId))];
    for (let id of users) {
      try { await bot.telegram.sendMessage(id, `📢 ${msg}`); } catch {}
    }
    msgCtx.reply('✅ Sent!');
  });
});

bot.action('font_menu', ctx => {
  const buttons = Object.keys(fonts).map(name => Markup.button.callback(name, `font_${name}`));
  ctx.reply('🔤 Choose font:', Markup.inlineKeyboard(buttons, { columns: 3 }));
});

bot.action(/^font_.+/, ctx => {
  const font = ctx.match[0].split('_')[1];
  currentFont = font;
  saveFont(font);
  ctx.editMessageText(`✅ Font switched to *${font}*`, { parse_mode: 'Markdown' });
});

bot.action('uptime', ctx => {
  const s = Math.floor(process.uptime());
  ctx.reply(`🕓 Uptime: ${Math.floor(s / 3600)}h ${(s % 3600) / 60 | 0}m ${s % 60}s`);
});

bot.action('my_profile', (ctx) => {
  const { id, username, first_name, last_name } = ctx.from;
  ctx.reply(`👤 *Profile:*
ID: \`${id}\`
Username: @${username || 'none'}
Name: ${first_name || ''} ${last_name || ''}`, { parse_mode: 'Markdown' });
});

bot.action('game_riddle', ctx => {
  ctx.reply("🧩 What has to be broken before you can use it?\n\nReply with your answer:");
  bot.once('text', answerCtx => {
    if (/egg/i.test(answerCtx.message.text)) {
      answerCtx.reply('✅ Correct! It\'s an egg.');
    } else {
      answerCtx.reply('❌ Nope. It\'s an egg.');
    }
  });
});

bot.action('game_dice', ctx => ctx.replyWithDice());

bot.action('wiki', ctx => {
  ctx.reply('📚 Send topic to search on Wikipedia:');
  bot.once('text', async (msgCtx) => {
    try {
      const query = encodeURIComponent(msgCtx.message.text);
      const res = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${query}`);
      msgCtx.reply(`📖 ${res.data.title}:\n${res.data.extract}`);
    } catch {
      msgCtx.reply('❌ Not found.');
    }
  });
});

bot.action('summarize', ctx => {
  ctx.reply('🧠 Send a long text to summarize:');
  bot.once('text', async (msgCtx) => {
    const input = msgCtx.message.text;
    try {
      const res = await axios.post('https://free.churchless.tech/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: `Summarize this:\n\n${input}` }]
      }, { headers: { 'Content-Type': 'application/json' } });
      msgCtx.reply(res.data.choices[0].message.content);
    } catch {
      msgCtx.reply('❌ Failed to summarize.');
    }
  });
});

bot.action('json_view', ctx => {
  ctx.reply('🧾 Send valid JSON to format:');
  bot.once('text', (msgCtx) => {
    try {
      const parsed = JSON.parse(msgCtx.message.text);
      msgCtx.replyWithMarkdown('```json\n' + JSON.stringify(parsed, null, 2) + '\n```');
    } catch {
      msgCtx.reply('❌ Invalid JSON.');
    }
  });
});

bot.action('eval_code', ctx => {
  ctx.reply('🧠 Send JS code to evaluate:');
  bot.once('text', (msgCtx) => {
    try {
      const result = eval(msgCtx.message.text);
      msgCtx.replyWithMarkdown(`✅ Result:\n\n\`\`\`${result}\`\`\``);
    } catch (err) {
      msgCtx.reply(`❌ Error:\n${err.message}`);
    }
  });
});

// === AI Chat ===
const aiEndpoints = [
  'https://api.giftedtech.co.ke/api/ai/gpt4o',
  'https://api.giftedtech.co.ke/api/ai/geminiaipro',
  'https://api.giftedtech.co.ke/api/ai/meta-llama',
  'https://api.giftedtech.co.ke/api/ai/gpt',
  'https://api.giftedtech.co.ke/api/ai/ai'
];

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name || 'User';
  const msg = ctx.message.text;
  let reply = '🤖 No response.';
  for (const url of aiEndpoints) {
    try {
      const res = await axios.get(url, { params: { apikey: 'gifted', q: msg } });
      if (res.data.result) {
        reply = res.data.result;
        break;
      }
    } catch {}
  }
  ctx.reply(stylize(reply));
  chatLogs.push({ time: new Date().toISOString(), userId, username, message: msg, response: reply });
  saveLogs();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Bot running on port ${PORT}`));
