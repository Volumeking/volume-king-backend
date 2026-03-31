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

// Generate a batch of fresh wallets
function generateWallets(count) {
  const wallets = [];
  for (let i = 0; i < count; i++) {
    const keypair = Keypair.generate();
    wallets.push({
      publicKey: keypair.publicKey.toBase58(),
      privateKey: bs58.encode(keypair.secretKey),
      keypair,
    });
  }
  return wallets;
}

// Fund each bot wallet with a small amount of SOL for gas
async function fundWallets(wallets, solEach) {
  const privateKeyBytes = bs58.decode(process.env.RECEIVING_WALLET_PRIVATE_KEY);
  const funder = Keypair.fromSecretKey(privateKeyBytes);
  const lamports = Math.floor(solEach * LAMPORTS_PER_SOL);

  console.log(`Funding ${wallets.length} wallets with ${solEach} SOL each...`);

  for (const wallet of wallets) {
    try {
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: funder.publicKey,
          toPubkey: new PublicKey(wallet.publicKey),
          lamports,
        }),
      );
      await sendAndConfirmTransaction(connection, tx, [funder]);
      console.log(`✅ Funded ${wallet.publicKey}`);
    } catch (err) {
      console.error(`❌ Failed to fund ${wallet.publicKey}:`, err.message);
    }
  }
}

// Drain remaining SOL from bot wallets back to receiving wallet
async function drainWallets(wallets) {
  const receivingWallet = new PublicKey(process.env.SOLANA_WALLET_ADDRESS);

  for (const wallet of wallets) {
    try {
      const balance = await connection.getBalance(wallet.keypair.publicKey);
      const fee = 5000;
      const amount = balance - fee;
      if (amount <= 0) continue;

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.keypair.publicKey,
          toPubkey: receivingWallet,
          lamports: amount,
        }),
      );
      await sendAndConfirmTransaction(connection, tx, [wallet.keypair]);
      console.log(`✅ Drained ${wallet.publicKey}`);
    } catch (err) {
      console.error(`❌ Failed to drain ${wallet.publicKey}:`, err.message);
    }
  }
}

module.exports = { generateWallets, fundWallets, drainWallets };
