const { Connection, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const { generateWallets, fundWallets, drainWallets } = require("./wallets");
const { sweepToColdWallet } = require("./sweep");
const { Order } = require("./models");

const connection = new Connection(process.env.SOLANA_RPC_URL, "confirmed");

const PACKAGE_DURATIONS = {
  "1h": 1 * 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
};

const PACKAGE_WALLETS = {
  "1h": 12,
  "6h": 25,
  "12h": 40,
  "1d": 60,
  "3d": 100,
  "1w": 150,
};

// Delay helper
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Random number between min and max
const rand = (min, max) => Math.random() * (max - min) + min;

async function runVolumeEngine(order, notifyActive, notifyComplete) {
  console.log(`🚀 Starting volume engine for order ${order.orderId}`);

  try {
    const walletCount = PACKAGE_WALLETS[order.packageId] || 12;
    const duration = PACKAGE_DURATIONS[order.packageId] || 60 * 60 * 1000;
    const solPerWallet = 0.01; // each wallet gets 0.01 SOL for gas

    // 1. Sweep payment to cold wallet
    await sweepToColdWallet(order.price);

    // 2. Generate fresh bot wallets
    const wallets = generateWallets(walletCount);

    // 3. Fund bot wallets
    await fundWallets(wallets, solPerWallet);

    // 4. Mark order as active and notify user
    await Order.findOneAndUpdate(
      { orderId: order.orderId },
      { status: "active", startedAt: new Date() },
    );
    if (notifyActive) notifyActive(order.telegramId, order);

    // 5. Run volume loop
    const endTime = Date.now() + duration;
    let totalTxs = 0;
    let walletIndex = 0;

    while (Date.now() < endTime) {
      const wallet = wallets[walletIndex % wallets.length];
      walletIndex++;

      try {
        // Simulate a buy transaction (transfer as placeholder)
        // Replace this with real Raydium swap once pool address is known
        console.log(
          `📈 Simulating trade from wallet ${wallet.publicKey.slice(0, 8)}... for token ${order.tokenAddress}`,
        );
        totalTxs++;

        // Update tx count in DB every 10 txs
        if (totalTxs % 10 === 0) {
          await Order.findOneAndUpdate(
            { orderId: order.orderId },
            { txsGenerated: totalTxs },
          );
        }
      } catch (err) {
        console.error("Trade error:", err.message);
      }

      // Random delay between trades (3-15 seconds)
      const delay = rand(3000, 15000);
      await sleep(delay);
    }

    // 6. Drain remaining SOL from bot wallets
    await drainWallets(wallets);

    // 7. Mark order complete
    await Order.findOneAndUpdate(
      { orderId: order.orderId },
      { status: "completed", completedAt: new Date(), txsGenerated: totalTxs },
    );

    console.log(
      `✅ Order ${order.orderId} complete. ${totalTxs} txs generated.`,
    );
    if (notifyComplete) notifyComplete(order.telegramId, order);
  } catch (err) {
    console.error(`❌ Engine error for ${order.orderId}:`, err.message);
    await Order.findOneAndUpdate(
      { orderId: order.orderId },
      { status: "failed" },
    );
  }
}

module.exports = { runVolumeEngine };
