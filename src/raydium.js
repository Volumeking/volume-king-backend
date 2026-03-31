const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} = require("@solana/web3.js");
const {
  Raydium,
  TxVersion,
  parseTokenAccountResp,
} = require("@raydium-io/raydium-sdk-v2");
const {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} = require("@solana/spl-token");
const bs58 = require("bs58");

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  "confirmed",
);

// Initialize Raydium SDK for a given wallet
async function initRaydium(keypair) {
  const raydium = await Raydium.load({
    owner: keypair,
    connection,
    disableFeatureCheck: true,
    blockhashCommitment: "finalized",
  });
  return raydium;
}

// Fetch pool info for a token address
async function getPoolInfo(raydium, tokenMint) {
  try {
    const data = await raydium.api.fetchPoolByMints({
      mint1: "So11111111111111111111111111111111111111112", // SOL
      mint2: tokenMint,
    });

    if (!data || !data.data || data.data.length === 0) {
      throw new Error(`No pool found for token ${tokenMint}`);
    }

    // Pick the pool with highest liquidity
    const pool = data.data.sort((a, b) => b.tvl - a.tvl)[0];
    console.log(`✅ Found pool: ${pool.id} TVL: $${pool.tvl}`);
    return pool;
  } catch (err) {
    console.error("getPoolInfo error:", err.message);
    throw err;
  }
}

// Execute a swap (buy or sell)
async function executeSwap(keypair, tokenMint, amountSOL, isBuy) {
  try {
    const raydium = await initRaydium(keypair);
    const pool = await getPoolInfo(raydium, tokenMint);

    const inputMint = isBuy
      ? "So11111111111111111111111111111111111111112" // SOL -> Token
      : tokenMint; // Token -> SOL

    const outputMint = isBuy
      ? tokenMint
      : "So11111111111111111111111111111111111111112";

    const amountIn = Math.floor(amountSOL * 1e9); // Convert to lamports

    const { execute } = await raydium.liquidity.swap({
      poolInfo: pool,
      amountIn,
      inputMint,
      fixedSide: "in",
      txVersion: TxVersion.V0,
      computeBudgetConfig: {
        units: 600000,
        microLamports: 10000,
      },
    });

    const { txIds } = await execute({ sendAndConfirm: true });
    console.log(
      `✅ Swap tx: ${txIds[0]} | ${isBuy ? "BUY" : "SELL"} ${amountSOL} SOL`,
    );
    return txIds[0];
  } catch (err) {
    console.error(`Swap error (${isBuy ? "BUY" : "SELL"}):`, err.message);
    return null;
  }
}

module.exports = { executeSwap, getPoolInfo };
