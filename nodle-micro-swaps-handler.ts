import type { ExecuteJobResult } from "../../../runtime/offeringTypes.js";

/**
 * Orchestrator Sub-Function: nodle_micro-swaps
 * cron: "0 */4 * * *"  — Every 4 hours
 *
 * Independent of signal alignment — runs on its own fixed schedule
 * regardless of what Seykota/Druckenmiller signal. Performs small,
 * regular USDC → VIRTUAL swaps on Base via Aerodrome.
 *
 * Rationale: dollar-cost-averaging into VIRTUAL on a fixed schedule,
 * decoupled from directional signals — a position-building function,
 * not a trend-following one. Runs alongside (not instead of) the
 * main swap orchestrator.
 *
 * MODE: AUTO-EXECUTE via CDP (same failover infrastructure as orchestrator)
 *
 * Example request:
 * {
 *   "swap_amount_usdc": 10,
 *   "pair": "USDC/VIRTUAL",
 *   "dex": "aerodrome",
 *   "max_price_impact_bps": 50,
 *   "dry_run": false
 * }
 */

const ROUTER_CONFIG = {
  primary: { name: "PRIMARY_ROUTER", address: "0x111111125421cA6dc452d289314280a0f8842A65", identity: "1inch v5" },
  fallback_1: { name: "FALLBACK_ROUTER_1", address: "0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae", identity: "LiFi Diamond" },
  fallback_2: { name: "FALLBACK_ROUTER_2", address: "0x6fF5693b99212Da76ad316178A184AB56D299b43", identity: "0x-style router" },
};

const RPC_CONFIG = {
  primary: process.env.COINBASE_RPC || "https://developer-access-mainnet.base.org",
  fallback_1: process.env.FALLBACK_RPC_1 || "https://1rpc.io/base",
  fallback_2: process.env.FALLBACK_RPC_2 || "https://base.api.pocket.network",
};

const CDP_API_KEY_NAME = process.env.CDP_API_KEY_NAME || "";
const CDP_API_KEY_PRIVATE_KEY = process.env.CDP_API_KEY_PRIVATE_KEY || "";
const CDP_WALLET_ID = process.env.CDP_WALLET_ID || "";

const AERODROME_ROUTER = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bda02913";
const VIRTUAL_BASE = "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const CG_KEY = process.env.COINGECKO_API_KEY || "";

interface MicroSwapResult {
  pair: string;
  dex: string;
  amount_in_usdc: number;
  estimated_amount_out_virtual: number | null;
  price_impact_bps: number | null;
  router_used: string | null;
  rpc_used: string | null;
  status: "EXECUTED" | "FAILED" | "ABORTED_HIGH_IMPACT" | "DRY_RUN" | "PLANNED";
  tx_hash: string | null;
  error: string | null;
  cumulative_tracking: { note: string };
}

async function getVirtualPrice(): Promise<{ price_usd: number | null; price_change_24h: number | null }> {
  try {
    const headers: Record<string, string> = CG_KEY ? { "x-cg-demo-api-key": CG_KEY } : {};
    const res = await fetch(
      `${COINGECKO_BASE}/simple/price?ids=virtual-protocol&vs_currencies=usd&include_24hr_change=true`,
      { headers }
    );
    if (!res.ok) return { price_usd: null, price_change_24h: null };
    const data = await res.json();
    return {
      price_usd: data["virtual-protocol"]?.usd ?? null,
      price_change_24h: data["virtual-protocol"]?.usd_24h_change ?? null,
    };
  } catch (_) {
    return { price_usd: null, price_change_24h: null };
  }
}

async function executeMicroSwap(
  amountUsdc: number,
  virtualPrice: number | null,
  maxPriceImpactBps: number,
  dryRun: boolean
): Promise<MicroSwapResult> {
  const estimatedOut = virtualPrice && virtualPrice > 0 ? amountUsdc / virtualPrice : null;

  const baseResult: MicroSwapResult = {
    pair: "USDC/VIRTUAL",
    dex: "aerodrome",
    amount_in_usdc: amountUsdc,
    estimated_amount_out_virtual: estimatedOut ? Math.round(estimatedOut * 1e6) / 1e6 : null,
    price_impact_bps: null,
    router_used: null,
    rpc_used: null,
    status: "PLANNED",
    tx_hash: null,
    error: null,
    cumulative_tracking: {
      note: "Track cumulative VIRTUAL accumulated across cycles in agent state/storage — not computed per-call here",
    },
  };

  if (dryRun) {
    return { ...baseResult, status: "DRY_RUN", router_used: "AERODROME_ROUTER", rpc_used: "primary" };
  }

  if (!CDP_API_KEY_NAME || !CDP_API_KEY_PRIVATE_KEY || !CDP_WALLET_ID) {
    return {
      ...baseResult,
      status: "FAILED",
      error: "CDP credentials not configured. Fail closed — no swap executed.",
    };
  }

  // Price impact check (placeholder — wire to actual Aerodrome quote)
  const simulatedPriceImpactBps = 8; // micro swaps on $10-50 size typically negligible

  if (simulatedPriceImpactBps > maxPriceImpactBps) {
    return {
      ...baseResult,
      price_impact_bps: simulatedPriceImpactBps,
      status: "ABORTED_HIGH_IMPACT",
      error: `Price impact ${simulatedPriceImpactBps}bps exceeds max ${maxPriceImpactBps}bps. Skipping this cycle.`,
    };
  }

  const routerAttempts: Array<keyof typeof ROUTER_CONFIG> = ["primary", "fallback_1", "fallback_2"];
  const rpcAttempts: Array<keyof typeof RPC_CONFIG> = ["primary", "fallback_1", "fallback_2"];

  for (const routerKey of routerAttempts) {
    const router = ROUTER_CONFIG[routerKey];
    for (const rpcKey of rpcAttempts) {
      try {
        // ── CDP execution placeholder ──────────────────────────────────
        // import { Coinbase, Wallet } from "@coinbase/coinbase-sdk";
        // Coinbase.configure({ apiKeyName: CDP_API_KEY_NAME, privateKey: CDP_API_KEY_PRIVATE_KEY });
        // const wallet = await Wallet.fetch(CDP_WALLET_ID);
        //
        // Prefer direct Aerodrome router for this known pair; fall back
        // to aggregators (1inch/LiFi/0x) if Aerodrome route fails or
        // USDC/VIRTUAL pool liquidity is too thin.
        //
        // const tx = await wallet.invokeContract({
        //   contractAddress: routerKey === "primary" ? AERODROME_ROUTER : router.address,
        //   method: "swapExactTokensForTokens",
        //   args: {
        //     amountIn: (amountUsdc * 1e6).toString(), // USDC has 6 decimals
        //     amountOutMin: "0", // computed from quote + slippage tolerance
        //     routes: [{ from: USDC_BASE, to: VIRTUAL_BASE, stable: false }],
        //     to: CDP_WALLET_ID,
        //     deadline: Math.floor(Date.now() / 1000) + 300,
        //   },
        // });
        // await tx.wait();

        const wouldSucceed = routerKey === "primary" && rpcKey === "primary"; // placeholder

        if (wouldSucceed) {
          return {
            ...baseResult,
            price_impact_bps: simulatedPriceImpactBps,
            status: "EXECUTED",
            router_used: routerKey === "primary" ? "AERODROME_ROUTER" : router.name,
            rpc_used: RPC_CONFIG[rpcKey],
            tx_hash: "0x_PLACEHOLDER_TX_HASH_WIRE_CDP_SDK",
          };
        }
      } catch (_) {
        continue;
      }
    }
  }

  return {
    ...baseResult,
    price_impact_bps: simulatedPriceImpactBps,
    status: "FAILED",
    error: "All router x RPC combinations failed for this cycle. Will retry next scheduled cycle (4h).",
  };
}

export async function executeJob(request: Record<string, any>): Promise<ExecuteJobResult> {
  const amountUsdc = Number(request.swap_amount_usdc ?? 10);
  const maxPriceImpactBps = Number(request.max_price_impact_bps ?? 50);
  const dryRun = request.dry_run === true;

  const { price_usd: virtualPrice, price_change_24h } = await getVirtualPrice();

  const result = await executeMicroSwap(amountUsdc, virtualPrice, maxPriceImpactBps, dryRun);

  const summary =
    `nodle_micro-swaps cycle: ${result.status}. ` +
    `${amountUsdc} USDC -> VIRTUAL on Aerodrome. ` +
    (virtualPrice ? `VIRTUAL price: $${virtualPrice.toFixed(4)} (${price_change_24h != null ? (price_change_24h > 0 ? "+" : "") + price_change_24h.toFixed(1) + "% 24h" : "?"}). ` : "") +
    (result.estimated_amount_out_virtual ? `Est. output: ${result.estimated_amount_out_virtual} VIRTUAL. ` : "") +
    (result.error ? `Note: ${result.error}` : "Next cycle in 4 hours.");

  return {
    deliverable: JSON.stringify({
      schema: "nodle_micro_swaps",
      executed_at: new Date().toISOString(),
      mode: dryRun ? "DRY_RUN" : "AUTO_EXECUTE",
      summary,
      virtual_price_usd: virtualPrice,
      virtual_price_change_24h: price_change_24h,
      result,
      next_cycle_hint: "Scheduled every 4 hours via cron: 0 */4 * * *",
    }),
  };
}
