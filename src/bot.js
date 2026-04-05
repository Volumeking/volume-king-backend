const TelegramBot = require("node-telegram-bot-api");
const { Order, User } = require("./models");
const { createToken } = require("./pumpfun");

const MINI_APP_URL =
  process.env.MINI_APP_URL || "https://your-mini-app.vercel.app";
const WEBHOOK_URL = `https://volume-king-backend-production.up.railway.app/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// Use webhook instead of polling to avoid 409 conflicts
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { webHook: true });

// Set the webhook
bot
  .setWebHook(WEBHOOK_URL)
  .then(() => {
    console.log("✅ Telegram webhook set");
  })
  .catch((err) => {
    console.error("❌ Failed to set webhook:", err.message);
  });

// ── Token creator session state ───────────────────────────────────────────────
const createSessions = {};

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
          [{ text: "🚀 Open Volume King", web_app: { url: MINI_APP_URL } }],
          [
            {
              text: "🪙 Create Token on pump.fun",
              callback_data: "create_token",
            },
          ],
        ],
      },
    },
  );
});

// ── /create ───────────────────────────────────────────────────────────────────
bot.onText(/\/create/, (msg) => {
  startCreateFlow(msg.from.id);
});

// ── Callback queries ──────────────────────────────────────────────────────────
bot.on("callback_query", async (query) => {
  const chatId = query.from.id;
  const data = query.data;

  bot.answerCallbackQuery(query.id);

  if (data === "create_token") {
    startCreateFlow(chatId);
  } else if (data === "boost_yes") {
    const session = createSessions[chatId];
    if (session?.tokenAddress) {
      bot.sendMessage(
        chatId,
        `🚀 *Let's boost your token!*\n\nOpen Volume King and enter this address:\n\`${session.tokenAddress}\``,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🚀 Open Volume King", web_app: { url: MINI_APP_URL } }],
            ],
          },
        },
      );
    }
    delete createSessions[chatId];
  } else if (data === "boost_no") {
    bot.sendMessage(
      chatId,
      "No problem! Your token is live on pump.fun. Good luck! 🚀",
    );
    delete createSessions[chatId];
  }
});

function startCreateFlow(chatId) {
  createSessions[chatId] = { step: "name" };
  bot.sendMessage(
    chatId,
    `🪙 *Create a Token on pump.fun*\n\n` +
      `Fee: *1 SOL* (includes initial buy)\n\n` +
      `Let's get started! What's your token name?`,
    { parse_mode: "Markdown" },
  );
}

// ── Handle create flow messages ───────────────────────────────────────────────
bot.on("message", async (msg) => {
  const chatId = msg.from.id;
  const session = createSessions[chatId];
  if (!session || msg.text?.startsWith("/")) return;

  if (session.step === "name") {
    session.name = msg.text.trim();
    session.step = "symbol";
    bot.sendMessage(
      chatId,
      "What's the token ticker/symbol? (e.g. PEPE, DOGE)",
    );
  } else if (session.step === "symbol") {
    session.symbol = msg.text.trim().toUpperCase();
    session.step = "description";
    bot.sendMessage(chatId, "Give your token a description:");
  } else if (session.step === "description") {
    session.description = msg.text.trim();
    session.step = "image";
    bot.sendMessage(
      chatId,
      "Send your token image (as a photo) or type 'skip' to use no image:",
    );
  } else if (session.step === "image") {
    if (msg.photo) {
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      session.imageFileId = fileId;
    }
    session.step = "wallet";
    bot.sendMessage(
      chatId,
      `Almost there! Send your *Solana wallet private key* so we can create the token on your behalf.\n\n` +
        `⚠️ This is used once to deploy your token and is never stored.`,
      { parse_mode: "Markdown" },
    );
  } else if (session.step === "wallet") {
    session.privateKey = msg.text.trim();
    session.step = "confirm";

    // Delete the message containing the private key for security
    bot.deleteMessage(chatId, msg.message_id).catch(() => {});

    bot.sendMessage(
      chatId,
      `✅ *Ready to launch!*\n\n` +
        `Token: *${session.name}* (${session.symbol})\n` +
        `Description: ${session.description}\n` +
        `Fee: *1 SOL*\n\n` +
        `Make sure you have at least 1 SOL in your wallet. Confirm to launch:`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ callback_data: "confirm_create", text: "🚀 Launch Token" }],
            [{ callback_data: "cancel_create", text: "❌ Cancel" }],
          ],
        },
      },
    );
  }
});

// ── Confirm/cancel create ─────────────────────────────────────────────────────
bot.on("callback_query", async (query) => {
  const chatId = query.from.id;
  const data = query.data;

  if (data === "confirm_create") {
    const session = createSessions[chatId];
    if (!session) return;

    bot.answerCallbackQuery(query.id);
    bot.sendMessage(
      chatId,
      "🔄 Launching your token on pump.fun... this may take 30-60 seconds.",
    );

    const result = await createToken({
      name: session.name,
      symbol: session.symbol,
      description: session.description,
      creatorPrivateKey: session.privateKey,
      buyAmountSOL: 0.5,
    });

    if (result.success) {
      session.tokenAddress = result.tokenAddress;
      session.step = "done";

      bot.sendMessage(
        chatId,
        `🎉 *Token Launched!*\n\n` +
          `Name: *${session.name}* (${session.symbol})\n` +
          `Address: \`${result.tokenAddress}\`\n\n` +
          `View on pump.fun: https://pump.fun/${result.tokenAddress}\n\n` +
          `Want to boost your token's volume with Volume King?`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ callback_data: "boost_yes", text: "🚀 Yes, boost it!" }],
              [{ callback_data: "boost_no", text: "No thanks" }],
            ],
          },
        },
      );
    } else {
      bot.sendMessage(
        chatId,
        `❌ Token creation failed: ${result.error}\n\nPlease try again with /create`,
      );
      delete createSessions[chatId];
    }
  } else if (data === "cancel_create") {
    bot.answerCallbackQuery(query.id);
    bot.sendMessage(chatId, "Token creation cancelled.");
    delete createSessions[chatId];
  }
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
      `/create — Create a token on pump.fun\n` +
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
