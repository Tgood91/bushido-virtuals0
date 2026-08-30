import type { ExecuteJobResult } from "../../../runtime/offeringTypes.js";

/**
 * Seykota Agent Job: Suggestions Schema
 * cron: "0 */4 * * *"  — Every 4 hours
 *
 * Generates actionable trading/farming suggestions based on current
 * market conditions across vol regime, funding, LP health, and chain TVL.
 *
 * Example request:
 * {
 *   "context": "volatility",          // "volatility" | "farming" | "l1" | "base" | "all"
 *   "risk_tier": "normal",            // "normal" | "reduced" | "defensive" | "survival"
 *   "account_equity": 10000,          // USD
 *   "active_positions": ["ETH-PERP"], // optional: current holdings for context
 * }
 */

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const DEFILLAMA_BASE = "https://api.llama.fi";
const CG_KEY = process.env.COINGECKO_API_KEY || "";

type RiskTier = "normal" | "reduced" | "defensive" | "survival";
type Context = "volatility" | "farming" | "l1" | "base" | "all";

interface Suggestion {
  id: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  category: string;
  action: string;
  rationale: string;
  signal: string;
  risk_tier_min: RiskTier;
  data_point?: string;
}

const RISK_ORDER: Record<RiskTier, number> = {
  normal: 0,
  reduced: 1,
  defensive: 2,
  survival: 3,
};

function tierAllowed(jobTier: RiskTier, positionTier: RiskTier): boolean {
  return RISK_ORDER[positionTier] <= RISK_ORDER[jobTier];
}

function buildSuggestions(
  markets: any[],
  tvlChains: any[],
  context: Context,
  riskTier: RiskTier,
  equity: number,
  activePositions: string[]
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // ── Vol regime signal from price momentum ──
  const eth = markets.find((m) => m.id === "ethereum");
  const btc = markets.find((m) => m.id === "bitcoin");
  const sol = markets.find((m) => m.id === "solana");

  const ethChange7d = eth?.price_change_percentage_7d_in_currency ?? 0;
  const btcChange7d = btc?.price_change_percentage_7d_in_currency ?? 0;
  const avgChange7d = (ethChange7d + btcChange7d) / 2;

  // Trend-following suggestion
  if ((context === "volatility" || context === "all") && avgChange7d < -8) {
    suggestions.push({
      id: "sg-vol-sell-premium",
      priority: "HIGH",
      category: "Volatility",
      action: "SELL VOL — Consider short straddle/strangle on ETH/BTC",
      rationale:
        "7-day decline of " +
        Math.abs(avgChange7d).toFixed(1) +
        "% has likely elevated IV above realized vol. IV-RV spread typically widens during selloffs as fear premium builds. Selling premium captures this mispricing.",
      signal: `BTC 7D: ${btcChange7d.toFixed(1)}% | ETH 7D: ${ethChange7d.toFixed(1)}%`,
      risk_tier_min: "normal",
    });
  }

  if ((context === "volatility" || context === "all") && avgChange7d > 10) {
    suggestions.push({
      id: "sg-vol-buy-gamma",
      priority: "MEDIUM",
      category: "Volatility",
      action: "BUY GAMMA — Long straddle into momentum continuation",
      rationale:
        "Strong uptrend (+${avgChange7d.toFixed(1)}% 7D) may compress IV below what realized vol will deliver. Positive gamma positions profit from continued large moves in either direction.",
      signal: `Avg 7D momentum: +${avgChange7d.toFixed(1)}%`,
      risk_tier_min: "normal",
    });
  }

  // ── LP farming suggestions from TVL data ──
  const baseTvl = tvlChains.find((c) => c.name?.toLowerCase() === "base");
  const ethTvl = tvlChains.find((c) => c.name?.toLowerCase() === "ethereum");

  if ((context === "farming" || context === "base" || context === "all") && baseTvl) {
    const baseTvlChange = baseTvl.change_7d ?? 0;
    if (baseTvlChange > 5) {
      suggestions.push({
        id: "sg-base-lp-expand",
        priority: "HIGH",
        category: "LP Farming",
        action: "EXPAND Base LP — TVL growing, deploy into Aerodrome/Uniswap V3 pools",
        rationale:
          "Base TVL up " +
          baseTvlChange.toFixed(1) +
          "% in 7 days. Rising TVL = rising volume = rising fee APR. Best window to enter LP before fee compression from TVL overshoot.",
        signal: `Base TVL: $${(baseTvl.tvl / 1e9).toFixed(2)}B (+${baseTvlChange.toFixed(1)}% 7D)`,
        risk_tier_min: "normal",
        data_point: `TVL: $${(baseTvl.tvl / 1e9).toFixed(2)}B`,
      });
    } else if (baseTvlChange < -5) {
      suggestions.push({
        id: "sg-base-lp-reduce",
        priority: "HIGH",
        category: "LP Farming",
        action: "REDUCE Base LP — TVL outflow detected, fee APR will compress",
        rationale:
          "Base TVL down " +
          Math.abs(baseTvlChange).toFixed(1) +
          "% in 7 days signals capital rotation away from Base. LP positions will earn less fees as volume drops. Consider tightening ranges or reducing allocation.",
        signal: `Base TVL: $${(baseTvl.tvl / 1e9).toFixed(2)}B (${baseTvlChange.toFixed(1)}% 7D)`,
        risk_tier_min: "reduced",
        data_point: `TVL: $${(baseTvl.tvl / 1e9).toFixed(2)}B`,
      });
    }
  }

  // ── L1 rotation suggestions ──
  if (context === "l1" || context === "all") {
    const sortedByMom = [...markets]
      .filter((m) => m.price_change_percentage_7d_in_currency != null)
      .sort(
        (a, b) =>
          b.price_change_percentage_7d_in_currency -
          a.price_change_percentage_7d_in_currency
      );

    const topL1 = sortedByMom[0];
    const bottomL1 = sortedByMom[sortedByMom.length - 1];

    if (topL1) {
      suggestions.push({
        id: "sg-l1-momentum-long",
        priority: "MEDIUM",
        category: "L1 Trend",
        action: `WATCH ${topL1.symbol?.toUpperCase()} — Strongest L1 momentum this week`,
        rationale:
          topL1.symbol?.toUpperCase() +
          " leads L1 momentum at +" +
          topL1.price_change_percentage_7d_in_currency.toFixed(1) +
          "% 7D. Trend-following principle: the strongest asset often continues to lead. Monitor for continuation setup.",
        signal: `${topL1.symbol?.toUpperCase()} 7D: +${topL1.price_change_percentage_7d_in_currency.toFixed(1)}%`,
        risk_tier_min: "normal",
      });
    }

    if (bottomL1 && bottomL1.price_change_percentage_7d_in_currency < -10) {
      suggestions.push({
        id: "sg-l1-momentum-short",
        priority: "MEDIUM",
        category: "L1 Trend",
        action: `WATCH SHORT ${bottomL1.symbol?.toUpperCase()} — Weakest L1, trend down`,
        rationale:
          bottomL1.symbol?.toUpperCase() +
          " is the weakest L1 at " +
          bottomL1.price_change_percentage_7d_in_currency.toFixed(1) +
          "% 7D. Relative weakness often persists. Ed Seykota: trade the trend, not the hope.",
        signal: `${bottomL1.symbol?.toUpperCase()} 7D: ${bottomL1.price_change_percentage_7d_in_currency.toFixed(1)}%`,
        risk_tier_min: "normal",
      });
    }
  }

  // ── Risk tier gate ──
  const allowed = suggestions.filter((s) =>
    tierAllowed(riskTier, s.risk_tier_min)
  );

  // ── Position overlap filter ──
  const filtered = allowed.filter((s) => {
    if (activePositions.length === 0) return true;
    return true; // Agent can decide based on summary
  });

  // Sort: HIGH first
  return filtered.sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return order[a.priority] - order[b.priority];
  });
}

export async function executeJob(
  request: Record<string, any>
): Promise<ExecuteJobResult> {
  const context: Context =
    (request.context as Context) || "all";
  const riskTier: RiskTier =
    (request.risk_tier as RiskTier) || "normal";
  const equity = Number(request.account_equity || 10000);
  const activePositions: string[] = request.active_positions || [];

  const cgHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(CG_KEY ? { "x-cg-demo-api-key": CG_KEY } : {}),
  };

  try {
    // Fetch L1 market data
    const L1_IDS =
      "bitcoin,ethereum,solana,avalanche-2,near,sui,aptos,cosmos,polkadot,cardano";
    const [marketRes, tvlRes] = await Promise.all([
      fetch(
        `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${L1_IDS}&price_change_percentage=7d,24h`,
        { headers: cgHeaders }
      ),
      fetch(`${DEFILLAMA_BASE}/v2/chains`),
    ]);

    const markets = marketRes.ok ? await marketRes.json() : [];
    const allChains = tvlRes.ok ? await tvlRes.json() : [];

    const suggestions = buildSuggestions(
      markets,
      allChains,
      context,
      riskTier,
      equity,
      activePositions
    );

    const summary =
      suggestions.length > 0
        ? `${suggestions.length} suggestion${suggestions.length > 1 ? "s" : ""} generated. ` +
          `High priority: ${suggestions.filter((s) => s.priority === "HIGH").length}. ` +
          `Top action: ${suggestions[0]?.action}`
        : "No high-conviction suggestions at current risk tier. Hold positions, monitor conditions.";

    return {
      deliverable: JSON.stringify({
        schema: "suggestions",
        generated_at: new Date().toISOString(),
        context,
        risk_tier: riskTier,
        account_equity_usd: equity,
        active_positions: activePositions,
        suggestion_count: suggestions.length,
        summary,
        suggestions,
      }),
    };
  } catch (e: any) {
    return {
      deliverable: JSON.stringify({
        schema: "suggestions",
        error: `Failed to generate suggestions: ${e.message}`,
        suggestions: [],
      }),
    };
  }
}
