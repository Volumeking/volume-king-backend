const express = require("express");
const crypto = require("crypto");
const { User, Order } = require("./models");
const { verifyPayment } = require("./solana");
const { runVolumeEngine } = require("./engine");
const { notifyOrderActive, notifyOrderComplete } = require("./bot");

const router = express.Router();

const PACKAGES = {
  "1h": { name: "1 Hour Boost", duration: "1 Hour", price: 1, wallets: 12 },
  "6h": { name: "6 Hour Boost", duration: "6 Hours", price: 3, wallets: 25 },
  "12h": { name: "12 Hour Boost", duration: "12 Hours", price: 5, wallets: 40 },
  "1d": { name: "1 Day Boost", duration: "24 Hours", price: 8, wallets: 60 },
  "3d": { name: "3 Day Boost", duration: "3 Days", price: 18, wallets: 100 },
  "1w": { name: "1 Week Boost", duration: "7 Days", price: 35, wallets: 150 },
};

// ── GET /api/wallet ───────────────────────────────────────────────────────────
router.get("/wallet", (req, res) => {
  res.json({ wallet: process.env.SOLANA_WALLET_ADDRESS });
});

// ── POST /api/orders ──────────────────────────────────────────────────────────
router.post("/orders", async (req, res) => {
  try {
    const { telegramId, username, firstName, packageId, tokenAddress } =
      req.body;

    if (!telegramId || !packageId || !tokenAddress) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const pkg = PACKAGES[packageId];
    if (!pkg) return res.status(400).json({ error: "Invalid package" });

    await User.findOneAndUpdate(
      { telegramId },
      { telegramId, username, firstName },
      { upsert: true, new: true },
    );

    const orderId = "VK-" + crypto.randomBytes(4).toString("hex").toUpperCase();

    const order = await Order.create({
      orderId,
      telegramId,
      packageId,
      packageName: pkg.name,
      duration: pkg.duration,
      price: pkg.price,
      tokenAddress,
      walletsUsed: pkg.wallets,
    });

    res.json({ orderId: order.orderId, price: pkg.price });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// ── POST /api/orders/:orderId/confirm ─────────────────────────────────────────
router.post("/orders/:orderId/confirm", async (req, res) => {
  try {
    const { signature } = req.body;
    const { orderId } = req.params;

    if (!signature) return res.status(400).json({ error: "Missing signature" });

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status !== "pending") {
      return res.status(400).json({ error: "Order already processed" });
    }

    const { valid, amountSOL, reason } = await verifyPayment(
      signature,
      order.price,
    );

    if (!valid) {
      return res.status(402).json({ error: "Payment invalid", reason });
    }

    // Mark payment confirmed
    order.paymentSignature = signature;
    order.paymentConfirmedAt = new Date();
    await order.save();

    // Update user stats
    await User.findOneAndUpdate(
      { telegramId: order.telegramId },
      { $inc: { totalOrders: 1, totalSpent: order.price } },
    );

    // Respond to client immediately
    res.json({ success: true, orderId, status: "active" });

    // Start volume engine in background (non-blocking)
    runVolumeEngine(order, notifyOrderActive, notifyOrderComplete);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Confirmation failed" });
  }
});

// ── GET /api/orders?telegramId=xxx ────────────────────────────────────────────
router.get("/orders", async (req, res) => {
  try {
    const { telegramId } = req.query;
    if (!telegramId)
      return res.status(400).json({ error: "Missing telegramId" });

    const orders = await Order.find({ telegramId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// ── GET /api/stats?telegramId=xxx ─────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const { telegramId } = req.query;
    if (!telegramId)
      return res.status(400).json({ error: "Missing telegramId" });

    const user = await User.findOne({ telegramId });
    const orders = await Order.find({ telegramId });

    const totalTxs = orders.reduce((sum, o) => sum + (o.txsGenerated || 0), 0);
    const completedOrders = orders.filter(
      (o) => o.status === "completed",
    ).length;
    const successRate = orders.length
      ? ((completedOrders / orders.length) * 100).toFixed(1)
      : 0;

    const breakdown = {};
    for (const o of orders) {
      breakdown[o.packageName] = (breakdown[o.packageName] || 0) + 1;
    }

    res.json({
      totalOrders: user?.totalOrders || 0,
      totalSpent: user?.totalSpent || 0,
      totalTxs,
      successRate: parseFloat(successRate),
      breakdown,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

module.exports = router;
