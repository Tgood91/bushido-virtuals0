/**
 * JOB: virtuals-dip-buy
 * 
 * TRIGGER: BASE_VIRTUALS drops -4% or more over 12 hours
 * ACTION: Swap $0.025 USDC → VIRTUALS automatically
 * FREQUENCY: Every 1 hour (check price movement)
 * 
 * Integration: Add to acp-jobs.config.ts as:
 * { id: "virtuals-dip-buy", cron: "0 * * * *", handler: "./handlers/virtuals-dip-buy.js" }
 */

// ──────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ──────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  // Token addresses on Base network
  TOKEN_IN: "0x833589fCD6eDb6E08f4c7C32D4f71b1566dA3DED",  // USDC
  TOKEN_OUT: "0x580E0b90fCA6Fb1b59BA4f9D66eC0c1D39c35DEb",  // VIRTUALS (Base)
  
  // Trade parameters
  SWAP_AMOUNT_USD: 0.025,           // Amount to swap when trigger hits
  PRICE_DROP_THRESHOLD: -0.04,      // -4% trigger
  LOOKBACK_HOURS: 12,               // Calculate drop over 12 hours
  CHECK_INTERVAL: "0 * * * *",      // Run every hour
  
  // Safety limits
  MAX_SLIPPAGE_PCT: 0.01,           // Allow max 1% slippage
  MIN_BALANCE_USDC: 0.05,           // Don't swap if balance < $0.05
  
  // Execution
  SWAP_METHOD: "hyperliquid",       // or "uniswap-v3", "1inch"
  DRY_RUN: false,                   // Set true to test without executing
  
  // Logging
  POST_TO_DEGEN: true,              // Post signal to degen.virtuals.io
  ALERT_ON_SWAP: true,              // Alert when trade executes
};

// ──────────────────────────────────────────────────────────────────────────────
// PRICE DATA FETCHER
// ──────────────────────────────────────────────────────────────────────────────

async function getPriceHistory() {
  /**
   * Fetch current price and price 12h ago
   * Returns: { currentPrice, price12hAgo, changePercent, timestamp }
   */

  try {
    // Option 1: Use CoinGecko API (free, no auth)
    const cgResponse = await fetch(
      `https://api.coingecko.com/api/v3/simple/token_price/base?contract_addresses=${CONFIG.TOKEN_OUT}&vs_currencies=usd&include_market_cap=false&include_24hr_vol=false&include_market_cap_change_24h=false`
    );
    
    if (!cgResponse.ok) {
      throw new Error(`CoinGecko API failed: ${cgResponse.status}`);
    }

    const cgData = await cgResponse.json();
    const currentPrice = cgData[CONFIG.TOKEN_OUT.toLowerCase()]?.usd;

    if (!currentPrice) {
      throw new Error("Could not fetch VIRTUALS current price from CoinGecko");
    }

    // Get 12h ago price from historical data (Dune Analytics or your data store)
    const price12hAgo = await fetchHistoricalPrice(CONFIG.TOKEN_OUT, 12);

    if (!price12hAgo) {
      console.warn("⚠ No 12h price history available yet, skipping");
      return null;
    }

    const changePercent = (currentPrice - price12hAgo) / price12hAgo;

    return {
      currentPrice,
      price12hAgo,
      changePercent,
      dropPct: Math.round(changePercent * 10000) / 100,
      timestamp: new Date().toISOString(),
    };

  } catch (err) {
    console.error("❌ Price fetch failed:", err.message);
    return null;
  }
}

async function fetchHistoricalPrice(tokenAddress, hoursAgo) {
  /**
   * Fetch price from 12 hours ago
   * Uses: Dune Analytics API, Alchemy, or local price cache
   */
  
  try {
    // Option 1: Query your local price cache (recommended)
    const cached = await getPriceCacheEntry(tokenAddress, hoursAgo);
    if (cached) return cached.price;

    // Option 2: Use Alchemy historical API
    const alchemyKey = process.env.ALCHEMY_API_KEY;
    if (!alchemyKey) {
      console.warn("⚠ ALCHEMY_API_KEY not set, using fallback");
      return null;
    }

    const response = await fetch(
      `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}/tokenPrice`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: tokenAddress,
          chainId: 8453, // Base chain ID
        }),
      }
    );

    const data = await response.json();
    return data?.tokenPrice?.price || null;

  } catch (err) {
    console.warn(`⚠ Historical price fetch failed: ${err.message}`);
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// SWAP EXECUTION
// ──────────────────────────────────────────────────────────────────────────────

async function executeSwap(amountUSDC, currentPrice) {
  /**
   * Execute USDC → VIRTUALS swap on Base network
   * Integrates with DegenClaw CLI or direct API
   */

  console.log(`🔄 Preparing swap: $${amountUSDC} USDC → VIRTUALS at $${currentPrice}`);

  if (CONFIG.DRY_RUN) {
    const tokensOut = amountUSDC / currentPrice;
    console.log(`📊 [DRY RUN] Would receive ~${tokensOut.toFixed(6)} VIRTUALS`);
    return { success: true, dryRun: true, tokensOut };
  }

  try {
    // Method 1: Use DegenClaw CLI (if available)
    if (CONFIG.SWAP_METHOD === "degenclaw") {
      return await executeViaDegenClaw(amountUSDC, currentPrice);
    }

    // Method 2: Direct Hyperliquid swap (if perp-enabled)
    if (CONFIG.SWAP_METHOD === "hyperliquid") {
      return await executeViaHyperliquid(amountUSDC, currentPrice);
    }

    // Method 3: Uniswap V3 SDK
    if (CONFIG.SWAP_METHOD === "uniswap-v3") {
      return await executeViaUniswapV3(amountUSDC, currentPrice);
    }

    throw new Error(`Unknown swap method: ${CONFIG.SWAP_METHOD}`);

  } catch (err) {
    console.error("❌ Swap execution failed:", err.message);
    return { success: false, error: err.message };
  }
}

async function executeViaDegenClaw(amountUSDC, currentPrice) {
  /**
   * Execute via dgclaw CLI
   * Requires: DegenClaw installed + authenticated
   */

  const { execSync } = require("child_process");
  const expectedOutput = (amountUSDC / currentPrice * 0.99).toFixed(6); // 1% slippage buffer

  try {
    const cmd = `dgclaw swap --from USDC --to VIRTUALS --amount ${amountUSDC} --max-slippage ${CONFIG.MAX_SLIPPAGE_PCT} --chain base`;
    
    console.log(`📡 Executing: ${cmd}`);
    const output = execSync(cmd, { encoding: "utf-8" });

    const txHash = output.match(/0x[a-f0-9]{64}/)?.[0];
    if (!txHash) throw new Error("No tx hash in response");

    return {
      success: true,
      method: "degenclaw",
      txHash,
      amountIn: amountUSDC,
      expectedOut: expectedOutput,
    };

  } catch (err) {
    throw new Error(`DegenClaw failed: ${err.message}`);
  }
}

async function executeViaHyperliquid(amountUSDC, currentPrice) {
  /**
   * Execute via Hyperliquid API
   * Note: HLP primarily supports perps, not spot swaps
   * This is a placeholder — use Uniswap for spot swaps on Base
   */

  console.warn("⚠ Hyperliquid does not support spot swaps on Base");
  console.log("→ Falling back to Uniswap V3");
  return executeViaUniswapV3(amountUSDC, currentPrice);
}

async function executeViaUniswapV3(amountUSDC, currentPrice) {
  /**
   * Execute USDC → VIRTUALS swap on Uniswap V3 (Base)
   * Requires: @uniswap/sdk-core, @uniswap/v3-sdk, ethers.js
   */

  try {
    const ethers = require("ethers");
    const { SwapRouter } = require("@uniswap/v3-sdk");

    // Wallet setup (from ACP agent private key)
    const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY);
    const provider = new ethers.JsonRpcProvider(
      `https://mainnet.base.org` // or Alchemy endpoint
    );
    const signer = wallet.connect(provider);

    // Convert amount to wei
    const amountInWei = ethers.parseUnits(amountUSDC.toString(), 6); // USDC is 6 decimals

    // Call Uniswap V3 SwapRouter
    const swapRouter = new SwapRouter({
      chainId: 8453, // Base
      signingKey: wallet.privateKey,
    });

    const tx = await swapRouter.swapExactInputSingle(
      {
        tokenIn: CONFIG.TOKEN_IN,
        tokenOut: CONFIG.TOKEN_OUT,
        fee: 3000, // 0.3% fee tier (most liquid)
        recipient: wallet.address,
        deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 min deadline
        amountIn: amountInWei,
        amountOutMinimum: ethers.parseUnits(
          (amountUSDC / currentPrice * (1 - CONFIG.MAX_SLIPPAGE_PCT)).toString(),
          18 // VIRTUALS is 18 decimals
        ),
      },
      signer
    );

    const receipt = await tx.wait();

    return {
      success: true,
      method: "uniswap-v3",
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      amountIn: amountUSDC,
    };

  } catch (err) {
    throw new Error(`Uniswap V3 swap failed: ${err.message}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// BALANCE & VALIDATION
// ──────────────────────────────────────────────────────────────────────────────

async function getUSDCBalance() {
  /**
   * Fetch current USDC balance from agent wallet
   */
  
  try {
    const ethers = require("ethers");
    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");

    const erc20Abi = [
      "function balanceOf(address owner) public view returns (uint256)",
      "function decimals() public view returns (uint8)",
    ];

    const contract = new ethers.Contract(CONFIG.TOKEN_IN, erc20Abi, provider);
    const walletAddress = process.env.AGENT_WALLET_ADDRESS;

    const balance = await contract.balanceOf(walletAddress);
    const decimals = await contract.decimals();

    return Number(ethers.formatUnits(balance, decimals));

  } catch (err) {
    console.error("❌ Balance fetch failed:", err.message);
    return 0;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// LOGGING & ALERTS
// ──────────────────────────────────────────────────────────────────────────────

async function postSignal(priceData, swapResult) {
  /**
   * Post trade signal to degen.virtuals.io via DegenClaw
   */

  if (!CONFIG.POST_TO_DEGEN) return;

  try {
    const { execSync } = require("child_process");

    const message = swapResult.success
      ? `✓ DIP BUY EXECUTED
VIRTUALS dropped ${priceData.dropPct}% in 12h
Swapped: $${CONFIG.SWAP_AMOUNT_USD} USDC → VIRTUALS at $${priceData.currentPrice}
TX: ${swapResult.txHash}
#TrendFollowing #DipBuy`
      : `⚠ DIP BUY SIGNAL (NOT EXECUTED)
VIRTUALS down ${priceData.dropPct}% over 12h
Would swap: $${CONFIG.SWAP_AMOUNT_USD} at $${priceData.currentPrice}
Reason: ${swapResult.error}`;

    execSync(`dgclaw post "${message}"`, { encoding: "utf-8" });
    console.log("📤 Signal posted to degen.virtuals.io");

  } catch (err) {
    console.warn("⚠ Failed to post signal:", err.message);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN JOB HANDLER
// ──────────────────────────────────────────────────────────────────────────────

async function executeJob() {
  console.log(`\n📍 [${new Date().toISOString()}] JOB: virtuals-dip-buy`);
  console.log("─".repeat(60));

  // Step 1: Fetch price history
  const priceData = await getPriceHistory();
  if (!priceData) {
    console.log("⏭ Skipping (no price data)");
    return { status: "skipped", reason: "no_price_data" };
  }

  console.log(`📊 VIRTUALS Price: $${priceData.currentPrice} (12h: $${priceData.price12hAgo})`);
  console.log(`📉 Change: ${priceData.dropPct}% over 12h`);

  // Step 2: Check if trigger hit
  if (priceData.changePercent > CONFIG.PRICE_DROP_THRESHOLD) {
    console.log(`✗ No trigger (${priceData.dropPct}% > -4%)`);
    return { status: "no_trigger", dropPct: priceData.dropPct };
  }

  console.log(`✓ TRIGGER HIT: ${priceData.dropPct}% ≤ -4.00%`);

  // Step 3: Check USDC balance
  const usdcBalance = await getUSDCBalance();
  console.log(`💵 USDC Balance: $${usdcBalance.toFixed(4)}`);

  if (usdcBalance < CONFIG.MIN_BALANCE_USDC) {
    console.log(`✗ Insufficient balance (need $${CONFIG.MIN_BALANCE_USDC})`);
    return { status: "insufficient_balance", balance: usdcBalance };
  }

  // Step 4: Execute swap
  console.log(`\n🔄 Executing swap...`);
  const swapResult = await executeSwap(CONFIG.SWAP_AMOUNT_USD, priceData.currentPrice);

  if (swapResult.success) {
    console.log(`✓ SWAP EXECUTED`);
    console.log(`  TX Hash: ${swapResult.txHash}`);
    console.log(`  Expected Output: ${swapResult.expectedOut || "unknown"} VIRTUALS`);
  } else {
    console.log(`❌ SWAP FAILED: ${swapResult.error}`);
  }

  // Step 5: Post signal
  await postSignal(priceData, swapResult);

  // Step 6: Return result
  console.log("─".repeat(60));
  return {
    status: swapResult.success ? "success" : "failed",
    dropPct: priceData.dropPct,
    currentPrice: priceData.currentPrice,
    swapAmount: CONFIG.SWAP_AMOUNT_USD,
    txHash: swapResult.txHash,
    dryRun: CONFIG.DRY_RUN,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// EXPORT FOR ACP SCHEDULER
// ──────────────────────────────────────────────────────────────────────────────

module.exports = {
  executeJob,
  CONFIG,
};

// ──────────────────────────────────────────────────────────────────────────────
// TEST / STANDALONE RUN
// ──────────────────────────────────────────────────────────────────────────────

if (require.main === module) {
  executeJob()
    .then(result => {
      console.log("\n✓ Job complete:");
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error("\n❌ Job failed:");
      console.error(err);
      process.exit(1);
    });
}
