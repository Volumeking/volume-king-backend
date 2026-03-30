const TelegramBot = require("node-telegram-bot-api");
const { Order, User } = require("./models");

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

const MINI_APP_URL =
  process.env.MINI_APP_URL || "https://your-mini-app.vercel.app";

// ── /start ────────────────────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const { id, username, first_name } = msg.from;

  await User.findOneAndUpdate(
    { telegramId: String(id) },
    { telegramId: String(id), username, firstName: first_name },
    { upsert: true, new: true },
  );

  bot.sendMessage(
    id,
    `👑 *Welcome to Volume King!*\n\nBoost your Solana token's volume with real on-chain transactions.\n\n` +
      `💰 Packages from 1 SOL\n⚡ Starts within 60s of payment\n📊 Track orders live in the app`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🚀 Open Volume King",
              web_app: { url: MINI_APP_URL },
            },
          ],
        ],
      },
    },
  );
});

// ── /orders ───────────────────────────────────────────────────────────────────
bot.onText(/\/orders/, async (msg) => {
  const telegramId = String(msg.from.id);
  const orders = await Order.find({ telegramId })
    .sort({ createdAt: -1 })
    .limit(5);

  if (!orders.length) {
    return bot.sendMessage(
      telegramId,
      "You have no orders yet. Open the app to get started!",
    );
  }

  const lines = orders.map(
    (o) =>
      `• *${o.packageName}* — \`${o.tokenAddress.slice(0, 6)}...${o.tokenAddress.slice(-4)}\`\n  Status: ${o.status.toUpperCase()} | ${o.price} SOL | ${o.orderId}`,
  );

  bot.sendMessage(
    telegramId,
    `📋 *Your Last 5 Orders*\n\n${lines.join("\n\n")}`,
    {
      parse_mode: "Markdown",
    },
  );
});

// ── /help ─────────────────────────────────────────────────────────────────────
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.from.id,
    `*Volume King Commands*\n\n` +
      `/start — Open the mini app\n` +
      `/orders — View your recent orders\n` +
      `/help — Show this message\n\n` +
      `For support, contact @yoursupporthandle`,
    { parse_mode: "Markdown" },
  );
});

// ── Notify user when order goes active ───────────────────────────────────────
async function notifyOrderActive(telegramId, order) {
  bot.sendMessage(
    telegramId,
    `✅ *Payment Confirmed!*\n\n` +
      `Your *${order.packageName}* is now live.\n` +
      `Token: \`${order.tokenAddress}\`\n` +
      `Order ID: \`${order.orderId}\`\n\n` +
      `Volume bot has started — sit back and watch the chart! 🚀`,
    { parse_mode: "Markdown" },
  );
}

// ── Notify user when order completes ─────────────────────────────────────────
async function notifyOrderComplete(telegramId, order) {
  bot.sendMessage(
    telegramId,
    `🏁 *Boost Complete!*\n\n` +
      `Your *${order.packageName}* has finished.\n` +
      `Token: \`${order.tokenAddress}\`\n` +
      `Transactions generated: *${order.txsGenerated.toLocaleString()}*\n\n` +
      `Ready for another run? Open the app below 👇`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Boost Again", web_app: { url: MINI_APP_URL } }],
        ],
      },
    },
  );
}

module.exports = { bot, notifyOrderActive, notifyOrderComplete };
