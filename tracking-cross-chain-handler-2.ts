import type { ExecuteJobResult } from "../../../runtime/offeringTypes.js";

/**
 * Seykota Agent Job: Tracking Cross-Chain Schema
 * cron: "0 */3 * * *"  — Every 3 hours
 *
 * Cross-chain intelligence layer: where is capital flowing BETWEEN chains?
 * Tracks bridge volumes, net flows, TVL momentum differentials, stablecoin
 * migration patterns, and identifies which chains are ABSORBING vs. LOSING capital.
 *
 * This is the macro layer above individual chains — it tells your agent
 * which ecosystem to be IN before price moves confirm the rotation.
 *
 * Key principle: capital flows precede price. Bridge inflows → TVL rise → fee
 * revenue rise → token price rise. Cross-chain monitoring captures step 1.
 *
 * Data: DeFiLlama (no key) + optional CoinGecko
 *
 * Example request:
 * {
 *   "chains": ["ethereum", "base", "fraxtal", "arbitrum", "optimism", "solana"],
 *   "bridge_threshold_usd": 1000000,   // min bridge flow to report
 *   "alert_net_flow_usd": 5000000,     // alert if net flow exceeds this
 *   "include_stablecoin_flows": true,
 *   "include_yield_comparison": true,
 * }
 */

const DEFILLAMA_BASE = "https://api.llama.fi";

interface ChainFlowSummary {
  chain: string;
  tvl_usd: number;
  tvl_change_1d_pct: number | null;
  tvl_change_7d_pct: number | null;
  tvl_momentum: "STRONG_INFLOW" | "INFLOW" | "STABLE" | "OUTFLOW" | "STRONG_OUTFLOW";
  dex_volume_24h: number | null;
  fee_revenue_24h: number | null;
  bridge_inflow_24h: number | null;
  bridge_outflow_24h: number | null;
  bridge_net_flow_24h: number | null;
  stablecoin_supply: number | null;
  stablecoin_change_7d_pct: number | null;
  capital_signal: "ACCUMULATE" | "HOLD" | "REDUCE" | "EXIT";
  relative_rank: number;           // ranked by 7D TVL growth
}

interface CrossChainFlow {
  from_chain: string;
  to_chain: string;
  volume_24h: number;
  bridge_name: string;
}

interface YieldComparison {
  chain: string;
  best_stable_apy: number | null;
  best_eth_lst_apy: number | null;
  top_protocol: string | null;
  yield_rank: number;
}

interface RotationSignal {
  type: "ROTATION" | "EXPANSION" | "CONTRACTION" | "CONSOLIDATION";
  from_chain: string | null;
  to_chain: string | null;
  evidence: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

function classifyMomentum(change7d: number | null): ChainFlowSummary["tvl_momentum"] {
  if (change7d == null) return "STABLE";
  if (change7d > 15) return "STRONG_INFLOW";
  if (change7d > 3) return "INFLOW";
  if (change7d < -15) return "STRONG_OUTFLOW";
  if (change7d < -3) return "OUTFLOW";
  return "STABLE";
}

function classifyCapitalSignal(
  tvlChange7d: number | null,
  bridgeNet: number | null,
  stableChange: number | null
): ChainFlowSummary["capital_signal"] {
  const tvlScore =
    (tvlChange7d ?? 0) > 10 ? 2 : (tvlChange7d ?? 0) > 3 ? 1 : (tvlChange7d ?? 0) < -10 ? -2 : (tvlChange7d ?? 0) < -3 ? -1 : 0;
  const bridgeScore =
    (bridgeNet ?? 0) > 1_000_000 ? 1 : (bridgeNet ?? 0) < -1_000_000 ? -1 : 0;
  const stableScore =
    (stableChange ?? 0) > 5 ? 1 : (stableChange ?? 0) < -5 ? -1 : 0;

  const total = tvlScore + bridgeScore + stableScore;

  if (total >= 3) return "ACCUMULATE";
  if (total >= 1) return "HOLD";
  if (total >= -1) return "HOLD";
  if (total >= -2) return "REDUCE";
  return "EXIT";
}

function detectRotationSignals(chains: ChainFlowSummary[]): RotationSignal[] {
  const signals: RotationSignal[] = [];
  const sorted = [...chains].sort(
    (a, b) => (b.tvl_change_7d_pct ?? 0) - (a.tvl_change_7d_pct ?? 0)
  );

  const winner = sorted[0];
  const loser = sorted[sorted.length - 1];

  // Rotation: one chain gaining while another losing
  if (
    (winner.tvl_change_7d_pct ?? 0) > 10 &&
    (loser.tvl_change_7d_pct ?? 0) < -10
  ) {
    signals.push({
      type: "ROTATION",
      from_chain: loser.chain,
      to_chain: winner.chain,
      evidence:
        `${winner.chain} TVL +${(winner.tvl_change_7d_pct ?? 0).toFixed(1)}% while ` +
        `${loser.chain} TVL ${(loser.tvl_change_7d_pct ?? 0).toFixed(1)}% — capital rotating`,
      confidence: "HIGH",
    });
  }

  // Expansion: most chains gaining TVL together
  const gainers = chains.filter((c) => (c.tvl_change_7d_pct ?? 0) > 3);
  if (gainers.length >= chains.length * 0.7) {
    signals.push({
      type: "EXPANSION",
      from_chain: null,
      to_chain: null,
      evidence: `${gainers.length}/${chains.length} tracked chains gaining TVL — broad crypto expansion phase`,
      confidence: gainers.length >= chains.length * 0.85 ? "HIGH" : "MEDIUM",
    });
  }

  // Contraction: most chains losing TVL
  const losers = chains.filter((c) => (c.tvl_change_7d_pct ?? 0) < -3);
  if (losers.length >= chains.length * 0.7) {
    signals.push({
      type: "CONTRACTION",
      from_chain: null,
      to_chain: null,
      evidence: `${losers.length}/${chains.length} tracked chains losing TVL — broad risk-off or bear phase`,
      confidence: losers.length >= chains.length * 0.85 ? "HIGH" : "MEDIUM",
    });
  }

  return signals;
}

export async function executeJob(
  request: Record<string, any>
): Promise<ExecuteJobResult> {
  const chainNames: string[] = (
    request.chains || [
      "ethereum", "base", "fraxtal", "arbitrum", "optimism",
      "solana", "avalanche", "bsc", "sui", "near",
    ]
  ).map((c: string) => c.toLowerCase());

  const bridgeThreshold = Number(request.bridge_threshold_usd || 1_000_000);
  const alertNetFlow = Number(request.alert_net_flow_usd || 5_000_000);
  const includeStable = request.include_stablecoin_flows !== false;
  const includeYield = request.include_yield_comparison !== false;

  try {
    // ── Parallel fetch ──
    const [chainRes, dexRes, feesRes, stableRes, bridgeRes, yieldRes] =
      await Promise.all([
        fetch(`${DEFILLAMA_BASE}/v2/chains`),
        fetch(
          `${DEFILLAMA_BASE}/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyVolume`
        ),
        fetch(
          `${DEFILLAMA_BASE}/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyFees`
        ),
        includeStable
          ? fetch(`${DEFILLAMA_BASE}/stablecoins?includePrices=true`)
          : Promise.resolve(null),
        fetch(`${DEFILLAMA_BASE}/bridges?includeChains=true`),
        includeYield
          ? fetch(`${DEFILLAMA_BASE}/pools`)
          : Promise.resolve(null),
      ]);

    // ── Chain TVL map ──
    const tvlMap: Record<string, { tvl: number; change1d: number | null; change7d: number | null }> = {};
    if (chainRes.ok) {
      const chains: any[] = await chainRes.json();
      for (const c of chains) {
        tvlMap[c.name?.toLowerCase()] = {
          tvl: c.tvl || 0,
          change1d: c.change_1d ?? null,
          change7d: c.change_7d ?? null,
        };
      }
    }

    // ── DEX volume map by chain ──
    const dexVolMap: Record<string, number> = {};
    if (dexRes.ok) {
      const dexData = await dexRes.json();
      for (const p of dexData.protocols || []) {
        const vol = p.total24h || 0;
        const chainCount = (p.chains || []).length || 1;
        for (const chain of p.chains || []) {
          const key = chain.toLowerCase();
          dexVolMap[key] = (dexVolMap[key] || 0) + vol / chainCount;
        }
      }
    }

    // ── Fee revenue map by chain ──
    const feeMap: Record<string, number> = {};
    if (feesRes.ok) {
      const feesData = await feesRes.json();
      for (const p of feesData.protocols || []) {
        const fee = p.total24h || 0;
        const chainCount = (p.chains || []).length || 1;
        for (const chain of p.chains || []) {
          const key = chain.toLowerCase();
          feeMap[key] = (feeMap[key] || 0) + fee / chainCount;
        }
      }
    }

    // ── Stablecoin map by chain ──
    const stableMap: Record<string, number> = {};
    if (includeStable && stableRes?.ok) {
      const sd = await stableRes.json();
      for (const asset of sd.peggedAssets || []) {
        for (const [chainName, circData] of Object.entries(
          asset.chainCirculating || {}
        )) {
          const key = chainName.toLowerCase();
          const circ = (circData as any)?.current?.peggedUSD || 0;
          stableMap[key] = (stableMap[key] || 0) + circ;
        }
      }
    }

    // ── Bridge flows ──
    const crossChainFlows: CrossChainFlow[] = [];
    const bridgeNetByChain: Record<string, { in: number; out: number }> = {};

    if (bridgeRes.ok) {
      const bridgeData = await bridgeRes.json();
      for (const b of bridgeData.bridges || []) {
        const bChains: string[] = (b.chains || []).map((c: string) =>
          c.toLowerCase()
        );
        const inflow = b.lastDayUsdTokenVolume || 0;
        const outflow = b.lastDayUsdTokenOutflowVolume || 0;

        for (const chain of bChains) {
          if (!bridgeNetByChain[chain]) {
            bridgeNetByChain[chain] = { in: 0, out: 0 };
          }
          bridgeNetByChain[chain].in += inflow / bChains.length;
          bridgeNetByChain[chain].out += outflow / bChains.length;
        }

        // Track significant cross-chain flows
        if (
          inflow > bridgeThreshold &&
          bChains.length >= 2 &&
          chainNames.some((n) => bChains.includes(n))
        ) {
          crossChainFlows.push({
            from_chain: bChains[1] || "unknown",
            to_chain: bChains[0] || "unknown",
            volume_24h: Math.round(inflow),
            bridge_name: b.displayName || b.name,
          });
        }
      }
    }

    // ── Yield comparison ──
    const yieldMap: Record<string, YieldComparison> = {};
    if (includeYield && yieldRes?.ok) {
      try {
        const poolData = await yieldRes.json();
        const pools: any[] = poolData.data || [];

        for (const chain of chainNames) {
          const chainPools = pools
            .filter(
              (p) =>
                p.chain?.toLowerCase() === chain &&
                p.apy != null &&
                p.apy > 0 &&
                p.tvlUsd > 100_000
            )
            .sort((a, b) => b.apy - a.apy);

          const stablePools = chainPools.filter(
            (p) =>
              p.stablecoin === true ||
              p.symbol?.toLowerCase().includes("usd") ||
              p.symbol?.toLowerCase().includes("frax")
          );

          const lstPools = chainPools.filter(
            (p) =>
              p.symbol?.toLowerCase().includes("eth") &&
              !p.symbol?.toLowerCase().includes("usd")
          );

          yieldMap[chain] = {
            chain,
            best_stable_apy: stablePools[0]?.apy
              ? Math.round(stablePools[0].apy * 10) / 10
              : null,
            best_eth_lst_apy: lstPools[0]?.apy
              ? Math.round(lstPools[0].apy * 10) / 10
              : null,
            top_protocol: chainPools[0]?.project || null,
            yield_rank: 0, // filled below
          };
        }

        // Rank by best stable APY
        const yieldRanked = Object.values(yieldMap).sort(
          (a, b) => (b.best_stable_apy ?? 0) - (a.best_stable_apy ?? 0)
        );
        yieldRanked.forEach((y, i) => {
          if (yieldMap[y.chain]) yieldMap[y.chain].yield_rank = i + 1;
        });
      } catch (_) {}
    }

    // ── Build chain summaries ──
    const chainSummaries: ChainFlowSummary[] = chainNames.map((name) => {
      const tvlData = tvlMap[name];
      const bridgeData = bridgeNetByChain[name];
      const bridgeNet = bridgeData
        ? Math.round(bridgeData.in - bridgeData.out)
        : null;

      return {
        chain: name,
        tvl_usd: tvlData?.tvl ?? 0,
        tvl_change_1d_pct: tvlData?.change1d != null ? Math.round(tvlData.change1d * 10) / 10 : null,
        tvl_change_7d_pct: tvlData?.change7d != null ? Math.round(tvlData.change7d * 10) / 10 : null,
        tvl_momentum: classifyMomentum(tvlData?.change7d ?? null),
        dex_volume_24h: dexVolMap[name] ? Math.round(dexVolMap[name]) : null,
        fee_revenue_24h: feeMap[name] ? Math.round(feeMap[name]) : null,
        bridge_inflow_24h: bridgeData ? Math.round(bridgeData.in) : null,
        bridge_outflow_24h: bridgeData ? Math.round(bridgeData.out) : null,
        bridge_net_flow_24h: bridgeNet,
        stablecoin_supply: stableMap[name] ? Math.round(stableMap[name]) : null,
        stablecoin_change_7d_pct: null, // requires historical
        capital_signal: classifyCapitalSignal(
          tvlData?.change7d ?? null,
          bridgeNet,
          null
        ),
        relative_rank: 0, // filled below
      };
    });

    // Rank by 7D TVL growth
    const ranked = [...chainSummaries].sort(
      (a, b) => (b.tvl_change_7d_pct ?? 0) - (a.tvl_change_7d_pct ?? 0)
    );
    ranked.forEach((c, i) => {
      const match = chainSummaries.find((s) => s.chain === c.chain);
      if (match) match.relative_rank = i + 1;
    });

    // ── Rotation signals ──
    const rotationSignals = detectRotationSignals(chainSummaries);

    // ── Alerts ──
    const alerts: string[] = [];
    for (const c of chainSummaries) {
      if (
        c.bridge_net_flow_24h != null &&
        Math.abs(c.bridge_net_flow_24h) > alertNetFlow
      ) {
        alerts.push(
          `${c.chain.toUpperCase()}: $${(Math.abs(c.bridge_net_flow_24h) / 1e6).toFixed(1)}M bridge ${c.bridge_net_flow_24h > 0 ? "INFLOW" : "OUTFLOW"} in 24h`
        );
      }
      if (c.tvl_momentum === "STRONG_OUTFLOW") {
        alerts.push(
          `${c.chain.toUpperCase()}: STRONG TVL OUTFLOW (${c.tvl_change_7d_pct}% 7D) — capital rotating away`
        );
      }
    }

    // ── Summary ──
    const topChain = chainSummaries.find((c) => c.relative_rank === 1);
    const bestSignal = chainSummaries.filter((c) => c.capital_signal === "ACCUMULATE");

    const summary =
      `Cross-chain scan: ${chainSummaries.length} chains. ` +
      (topChain
        ? `Strongest TVL growth: ${topChain.chain.toUpperCase()} (+${topChain.tvl_change_7d_pct ?? 0}% 7D). `
        : "") +
      (bestSignal.length > 0
        ? `ACCUMULATE signal on: ${bestSignal.map((c) => c.chain.toUpperCase()).join(", ")}. `
        : "") +
      `${rotationSignals.length} rotation signal(s). ` +
      `${alerts.length} alert(s).`;

    return {
      deliverable: JSON.stringify({
        schema: "tracking_cross_chain",
        tracked_at: new Date().toISOString(),
        chain_count: chainSummaries.length,
        rotation_signals: rotationSignals,
        alerts,
        summary,
        chains: chainSummaries,
        cross_chain_flows: crossChainFlows
          .sort((a, b) => b.volume_24h - a.volume_24h)
          .slice(0, 20),
        yield_comparison: includeYield
          ? Object.values(yieldMap).sort((a, b) => a.yield_rank - b.yield_rank)
          : [],
      }),
    };
  } catch (e: any) {
    return {
      deliverable: JSON.stringify({
        schema: "tracking_cross_chain",
        error: `Cross-chain tracking failed: ${e.message}`,
        chains: [],
      }),
    };
  }
}
