const { PumpFunSDK } = require("pumpdotfun-sdk");
const { Connection, Keypair, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const { AnchorProvider } = require("@coral-xyz/anchor");
const bs58 = require("bs58");
const fs = require("fs");
const path = require("path");

const connection = new Connection(process.env.SOLANA_RPC_URL, "confirmed");

async function createToken({
  name,
  symbol,
  description,
  imageUrl,
  creatorPrivateKey,
  buyAmountSOL,
}) {
  try {
    // Load creator wallet
    const privateKeyBytes = bs58.decode(creatorPrivateKey);
    const creatorKeypair = Keypair.fromSecretKey(privateKeyBytes);

    // Set up provider
    const wallet = {
      publicKey: creatorKeypair.publicKey,
      signTransaction: async (tx) => {
        tx.sign(creatorKeypair);
        return tx;
      },
      signAllTransactions: async (txs) => {
        txs.forEach((tx) => tx.sign(creatorKeypair));
        return txs;
      },
    };

    const provider = new AnchorProvider(connection, wallet, {
      commitment: "finalized",
    });
    const sdk = new PumpFunSDK(provider);

    // Generate a new mint keypair for the token
    const mintKeypair = Keypair.generate();

    // Token metadata
    const tokenMetadata = {
      name,
      symbol,
      description,
      showName: true,
    };

    // If image URL provided, fetch it
    if (imageUrl) {
      tokenMetadata.imageUrl = imageUrl;
    }

    const buyAmountLamports = BigInt(
      Math.floor((buyAmountSOL || 0.01) * LAMPORTS_PER_SOL),
    );

    console.log(`🚀 Creating token ${name} (${symbol}) on pump.fun...`);

    const result = await sdk.createAndBuy(
      creatorKeypair,
      mintKeypair,
      tokenMetadata,
      buyAmountLamports,
      BigInt(100), // 1% slippage
      {
        unitLimit: 250000,
        unitPrice: 250000,
      },
    );

    if (result.success) {
      const tokenAddress = mintKeypair.publicKey.toBase58();
      console.log(`✅ Token created: ${tokenAddress}`);
      return { success: true, tokenAddress, txSignature: result.signature };
    } else {
      throw new Error("Token creation failed");
    }
  } catch (err) {
    console.error("pump.fun error:", err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { createToken };
