const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} = require("@solana/web3.js");
const bs58 = require("bs58");

const connection = new Connection(process.env.SOLANA_RPC_URL, "confirmed");

async function sweepToColdWallet(amountSOL) {
  try {
    const privateKeyBytes = bs58.decode(
      process.env.RECEIVING_WALLET_PRIVATE_KEY,
    );
    const receivingKeypair = Keypair.fromSecretKey(privateKeyBytes);
    const coldWallet = new PublicKey(process.env.COLD_WALLET_ADDRESS);

    // Get current balance
    const balance = await connection.getBalance(receivingKeypair.publicKey);
    const fee = 5000; // ~0.000005 SOL for tx fee
    const sweepAmount = balance - fee;

    if (sweepAmount <= 0) {
      console.log("Not enough balance to sweep");
      return false;
    }

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: receivingKeypair.publicKey,
        toPubkey: coldWallet,
        lamports: sweepAmount,
      }),
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [
      receivingKeypair,
    ]);
    console.log(
      `✅ Swept ${sweepAmount / LAMPORTS_PER_SOL} SOL to cold wallet. TX: ${signature}`,
    );
    return signature;
  } catch (err) {
    console.error("Sweep error:", err.message);
    return false;
  }
}

module.exports = { sweepToColdWallet };
