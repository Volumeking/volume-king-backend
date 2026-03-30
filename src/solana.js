const { Connection, PublicKey, LAMPORTS_PER_SOL } = require("@solana/web3.js");

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  "confirmed",
);

const WALLET = process.env.SOLANA_WALLET_ADDRESS;

/**
 * Verify a Solana transaction signature:
 * - Confirms the tx exists and succeeded
 * - Checks that it sent >= expectedSOL to our wallet
 * Returns { valid: bool, amountSOL: number }
 */
async function verifyPayment(signature, expectedSOL) {
  try {
    const tx = await connection.getParsedTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx || tx.meta?.err) {
      return { valid: false, reason: "Transaction not found or failed" };
    }

    // Find transfer to our wallet
    const instructions = tx.transaction.message.instructions;
    let receivedLamports = 0;

    for (const ix of instructions) {
      if (
        ix.parsed?.type === "transfer" &&
        ix.parsed?.info?.destination === WALLET
      ) {
        receivedLamports += ix.parsed.info.lamports;
      }
    }

    const receivedSOL = receivedLamports / LAMPORTS_PER_SOL;
    const valid = receivedSOL >= expectedSOL * 0.99;

    return { valid, amountSOL: receivedSOL };
  } catch (err) {
    console.error("Solana verification error:", err.message);
    return { valid: false, reason: err.message };
  }
}

module.exports = { verifyPayment };
