import type { ExecuteJobResult } from "../../../runtime/offeringTypes.js";

/**
 * Seykota Agent Job: Tracking Chain Schema
 * cron: "0 */4 * * *"  — Every 4 hours
 *
 * Tracks full chain-level health metrics: TVL, TVL momentum, active protocols,
 * DEX volume, stablecoin flows, bridge inflows/outflows, and fee revenue.
 * Chain-level data is the macro layer — it tells you WHERE capital is flowing
 * before the token prices reflect it. TVL leads price.
 *
 * Example request:
 * {
 *   "chains": ["base", "ethereum", "solana", "avalanche"],
 *   "include_protocols": true,    // top protocols by TVL per chain
 *   "include_stablecoins": true,  // stablecoin breakdown
 *   "include_bridges": false,
 * }
 */

const DEFILLAMA_BASE = "https://api.llama.fi";

interface ChainSnapshot {
  name: string;
  tvl: number;
  tvl_change_1d: number | null;
  tvl_change_7d: number | null;
  tvl_momentum: "INFLOW" | "OUTFLOW" | "STABLE";
  tvl_rank: number;
  dex_volume_24h: number | null;
  fee_revenue_24h: number | null;
  protocol_count: number | null;
  dominant_protocol: string | null;
  stablecoin_tvl: number | null;
  chain_signal: "ACCUMULATING" | "DISTRIBUTING" | "NEUTRAL" | "WATCH";
  alert: string | null;
}

interface ProtocolEntry {
  name: string;
  chain: string;
  tvl: number;
  tvl_change_7d: number | null;
  category: string;
}

interface StablecoinEntry {
  chain: string;
  total_circulating: number;
  change_7d: number | null;
  dominant_stable: string | null;
}

function classifyMomentum(change7d: number | null): ChainSnapshot["tvl_momentum"] {
  if (change7d == null) return "STABLE";
  if (change7d > 3) return "INFLOW";
  if (change7d < -3) return "OUTFLOW";
  return "STABLE";
}

function buildChainSignal(
  tvlChange7d: number | null,
  dexVol: number | null,
  tvl: number
): ChainSnapshot["chain_signal"] {
  const momentum = classifyMomentum(tvlChange7d);
  const volTvl = tvl > 0 && dexVol != null ? (dexVol / tvl) * 100 : null;

  if (momentum === "INFLOW" && volTvl != null && volTvl > 5) return "ACCUMULATING";
  if (momentum === "OUTFLOW" && volTvl != null && volTvl > 10) return "DISTRIBUTING";
  if (
    (tvlChange7d != null && Math.abs(tvlChange7d) > 15) ||
    (volTvl != null && volTvl > 20)
  )
    return "WATCH";
  return "NEUTRAL";
}

function buildAlert(snap: Partial<ChainSnapshot>): string | null {
  if ((snap.tvl_change_7d ?? 0) < -15)
    return `MAJOR OUTFLOW: TVL dropped ${Math.abs(snap.tvl_change_7d ?? 0).toFixed(1)}% in 7 days — capital rotation in progress`;
  if ((snap.tvl_change_7d ?? 0) > 20)
    return `MAJOR INFLOW: TVL +${(snap.tvl_change_7d ?? 0).toFixed(1)}% in 7 days — strong capital attraction`;
  if (snap.chain_signal === "DISTRIBUTING")
    return `DISTRIBUTION: High DEX volume + TVL outflow = smart money exiting`;
  return null;
}

export async function executeJob(
  request: Record<string, any>
): Promise<ExecuteJobResult> {
  const chainNames: string[] = (
    request.chains || ["base", "ethereum", "solana", "avalanche", "arbitrum", "optimism", "sui", "near"]
  ).map((c: string) => c.toLowerCase());

  const includeProtocols = request.include_protocols !== false;
  const includeStablecoins = request.include_stablecoins !== false;

  try {
    // ── Fetch all chain TVL data ──
    const [chainRes, protocolRes, stableRes, dexRes, feesRes] = await Promise.all([
      fetch(`${DEFILLAMA_BASE}/v2/chains`),
      includeProtocols ? fetch(`${DEFILLAMA_BASE}/protocols`) : Promise.resolve(null),
      includeStablecoins ? fetch(`${DEFILLAMA_BASE}/stablecoins?includePrices=true`) : Promise.resolve(null),
      fetch(`${DEFILLAMA_BASE}/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyVolume`),
      fetch(`${DEFILLAMA_BASE}/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyFees`),
    ]);

    const allChains: any[] = chainRes.ok ? await chainRes.json() : [];
    const allProtocols: any[] = protocolRes?.ok ? (await protocolRes.json()) : [];
    const stableData: any = stableRes?.ok ? await stableRes.json() : null;
    const dexData: any = dexRes.ok ? await dexRes.json() : null;
    const feesData: any = feesRes.ok ? await feesRes.json() : null;

    // ── Build DEX volume map by chain ──
    const dexVolumeByChain: Record<string, number> = {};
    if (dexData?.protocols) {
      for (const p of dexData.protocols) {
        for (const chain of (p.chains || [])) {
          const vol = p.total24h || 0;
          const chainKey = chain.toLowerCase();
          dexVolumeByChain[chainKey] = (dexVolumeByChain[chainKey] || 0) + vol / (p.chains?.length || 1);
        }
      }
    }

    // ── Build fee revenue map by chain ──
    const feesByChain: Record<string, number> = {};
    if (feesData?.protocols) {
      for (const p of feesData.protocols) {
        for (const chain of (p.chains || [])) {
          const fee = p.total24h || 0;
          const chainKey = chain.toLowerCase();
          feesByChain[chainKey] = (feesByChain[chainKey] || 0) + fee / (p.chains?.length || 1);
        }
      }
    }

    // ── Build stablecoin map by chain ──
    const stableByChain: Record<string, StablecoinEntry> = {};
    if (stableData?.peggedAssets) {
      for (const asset of stableData.peggedAssets) {
        const chains = asset.chainCirculating || {};
        for (const [chainName, circData] of Object.entries(chains)) {
          const key = chainName.toLowerCase();
          const circ = (circData as any)?.current?.peggedUSD || 0;
          if (!stableByChain[key]) {
            stableByChain[key] = {
              chain: chainName,
              total_circulating: 0,
              change_7d: null,
              dominant_stable: null,
            };
          }
          stableByChain[key].total_circulating += circ;
        }
      }
    }

    // ── Sort chains by TVL globally for rank ──
    const sortedAllChains = [...allChains].sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
    const rankMap: Record<string, number> = {};
    sortedAllChains.forEach((c, i) => {
      rankMap[c.name?.toLowerCase()] = i + 1;
    });

    // ── Build chain snapshots ──
    const snapshots: ChainSnapshot[] = [];

    for (const name of chainNames) {
      const chainData = allChains.find(
        (c) => c.name?.toLowerCase() === name
      );

      if (!chainData) {
        snapshots.push({
          name,
          tvl: 0,
          tvl_change_1d: null,
          tvl_change_7d: null,
          tvl_momentum: "STABLE",
          tvl_rank: 999,
          dex_volume_24h: null,
          fee_revenue_24h: null,
          protocol_count: null,
          dominant_protocol: null,
          stablecoin_tvl: null,
          chain_signal: "NEUTRAL",
          alert: null,
        });
        continue;
      }

      const tvl = chainData.tvl || 0;
      const change1d = chainData.change_1d ?? null;
      const change7d = chainData.change_7d ?? null;
      const dexVol = dexVolumeByChain[name] ?? null;
      const feeRev = feesByChain[name] ?? null;

      // Top protocol for this chain
      const chainProtos = allProtocols
        .filter((p) => (p.chains || []).map((c: string) => c.toLowerCase()).includes(name))
        .sort((a, b) => (b.tvl || 0) - (a.tvl || 0));

      const snap: ChainSnapshot = {
        name: chainData.name,
        tvl,
        tvl_change_1d: change1d != null ? Math.round(change1d * 10) / 10 : null,
        tvl_change_7d: change7d != null ? Math.round(change7d * 10) / 10 : null,
        tvl_momentum: classifyMomentum(change7d),
        tvl_rank: rankMap[name] || 999,
        dex_volume_24h: dexVol ? Math.round(dexVol) : null,
        fee_revenue_24h: feeRev ? Math.round(feeRev) : null,
        protocol_count: chainProtos.length || null,
        dominant_protocol: chainProtos[0]?.name || null,
        stablecoin_tvl: stableByChain[name]?.total_circulating
          ? Math.round(stableByChain[name].total_circulating)
          : null,
        chain_signal: buildChainSignal(change7d, dexVol, tvl),
        alert: null,
      };
      snap.alert = buildAlert(snap);
      snapshots.push(snap);
    }

    // ── Top protocols per chain ──
    const topProtocols: ProtocolEntry[] = includeProtocols
      ? chainNames.flatMap((name) => {
          return allProtocols
            .filter((p) =>
              (p.chains || []).map((c: string) => c.toLowerCase()).includes(name)
            )
            .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
            .slice(0, 5)
            .map((p) => ({
              name: p.name,
              chain: name,
              tvl: p.tvl || 0,
              tvl_change_7d: p.change_7d ?? null,
              category: p.category || "unknown",
            }));
        })
      : [];

    // ── Summary ──
    const alerts = snapshots.filter((s) => s.alert);
    const accumulating = snapshots.filter((s) => s.chain_signal === "ACCUMULATING");
    const distributing = snapshots.filter((s) => s.chain_signal === "DISTRIBUTING");
    const totalTvl = snapshots.reduce((sum, s) => sum + s.tvl, 0);

    const topChain = [...snapshots].sort((a, b) => b.tvl - a.tvl)[0];
    const fastestGrowing = [...snapshots]
      .filter((s) => s.tvl_change_7d != null)
      .sort((a, b) => (b.tvl_change_7d ?? 0) - (a.tvl_change_7d ?? 0))[0];

    const summary =
      `Tracked ${snapshots.length} chains. ` +
      `Combined TVL: $${(totalTvl / 1e9).toFixed(2)}B. ` +
      `${accumulating.length} accumulating, ${distributing.length} distributing. ` +
      (fastestGrowing?.tvl_change_7d != null
        ? `Fastest growing: ${fastestGrowing.name} (+${fastestGrowing.tvl_change_7d.toFixed(1)}% 7D TVL). `
        : "") +
      `${alerts.length} alert${alerts.length !== 1 ? "s" : ""} triggered.`;

    return {
      deliverable: JSON.stringify({
        schema: "tracking_chain",
        tracked_at: new Date().toISOString(),
        chain_count: snapshots.length,
        total_tvl_usd: totalTvl,
        alerts_triggered: alerts.length,
        accumulating_chains: accumulating.map((s) => s.name),
        distributing_chains: distributing.map((s) => s.name),
        summary,
        chains: snapshots,
        top_protocols: topProtocols,
        stablecoins: includeStablecoins
          ? chainNames.map((name) => stableByChain[name] || { chain: name, total_circulating: 0, change_7d: null })
          : [],
        alerts: alerts.map((s) => ({
          chain: s.name,
          signal: s.chain_signal,
          tvl_usd: s.tvl,
          tvl_change_7d: s.tvl_change_7d,
          message: s.alert,
        })),
      }),
    };
  } catch (e: any) {
    return {
      deliverable: JSON.stringify({
        schema: "tracking_chain",
        error: `Chain tracking failed: ${e.message}`,
        chains: [],
      }),
    };
  }
}
