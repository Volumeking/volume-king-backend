const mongoose = require("mongoose");

// ── User ──────────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    telegramId: { type: String, required: true, unique: true },
    username: { type: String },
    firstName: { type: String },
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    totalTxs: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// ── Order ─────────────────────────────────────────────────────────────────────
const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true },
    telegramId: { type: String, required: true },

    // Package details
    packageId: { type: String, required: true },
    packageName: { type: String, required: true },
    duration: { type: String, required: true },
    price: { type: Number, required: true },

    // Token
    tokenAddress: { type: String, required: true },

    // Payment
    status: {
      type: String,
      enum: ["pending", "active", "completed", "failed"],
      default: "pending",
    },
    paymentSignature: { type: String },
    paymentConfirmedAt: { type: Date },

    // Bot execution
    txsGenerated: { type: Number, default: 0 },
    walletsUsed: { type: Number, default: 0 },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);
const Order = mongoose.model("Order", orderSchema);

module.exports = { User, Order };
