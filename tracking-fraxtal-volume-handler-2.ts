import type { ExecuteJobResult } from "../../../runtime/offeringTypes.js";

/**
 * Seykota Agent Job: Tracking Fraxtal Chain Volume Schema
 * cron: "*/20 * * * *"  — Every 20 minutes
 *
 * Deep volume tracking specific to the Fraxtal chain:
 *   - DEX volume by protocol (Fraxswap, Curve, Uniswap forks)
 *   - Bridge volume (inflows vs. outflows)
 *   - Stablecoin (FRAX) circulating supply + peg
 *   - Lending volume (Fraxlend utilization)
 *   - Fee revenue (protocol + chain)
 *   - Volume-to-TVL ratio (efficiency signal)
 *
 * DeFiLlama chain name: "Fraxtal" (confirmed)
 * Data sources: DeFiLlama (no key required)
 *
 * Example request:
 * {
 *   "include_protocols": true,     // per-protocol volume breakdown
 *   "include_bridge": true,        // bridge in/out volume
 *   "include_lending": true,       // Fraxlend utilization
 *   "vol_spike_threshold": 2.0,    // alert if vol > X× 7-day avg
 * }
 */

const DEFILLAMA_BASE = "https://api.llama.fi";
const FRAXTAL_CHAIN = "Fraxtal";

interface ProtocolVolume {
  name: string;
  category: string;
  volume_24h: number;
  volume_7d_avg: number;
  volume_ratio: number;          // 24h / 7d avg
  tvl: number;
  volume_tvl_ratio: number;      // efficiency: high = active relative to size
  signal: "SPIKE" | "ELEVATED" | "NORMAL" | "LOW";
}

interface BridgeFlow {
  protocol: string;
  inflow_24h: number;
  outflow_24h: number;
  net_flow_24h: number;
  flow_direction: "INFLOW" | "OUTFLOW" | "BALANCED";
}

interface LendingMetrics {
  protocol: string;
  total_borrowed: number;
  total_supplied: number;
  utilization_pct: number;
  borrow_apy: number | null;
  supply_apy: number | null;
  utilization_signal: "OVERCROWDED" | "HEALTHY" | "UNDERUTILIZED";
}

interface ChainVolumeSnapshot {
  chain: string;
  snapshot_at: string;
  tvl_usd: number;
  tvl_change_1d_pct: number | null;
  tvl_change_7d_pct: number | null;
  dex_volume_24h: number | null;
  dex_volume_7d_avg: number | null;
  dex_volume_ratio: number | null;
  fee_revenue_24h: number | null;
  volume_tvl_ratio: number | null;       // chain efficiency
  stablecoin_circulating: number | null;
  stablecoin_change_7d: number | null;
  net_bridge_flow_24h: number | null;
  bridge_direction: "INFLOW" | "OUTFLOW" | "BALANCED" | null;
  vol_regime: "SPIKE" | "ELEVATED" | "NORMAL" | "QUIET";
  chain_health: "GROWING" | "STABLE" | "CONTRACTING" | "STRESSED";
  alerts: string[];
}

function classifyVolSignal(ratio: number | null): ProtocolVolume["signal"] {
  if (ratio == null) return "NORMAL";
  if (ratio >= 2.5) return "SPIKE";
  if (ratio >= 1.4) return "ELEVATED";
  if (ratio >= 0.6) return "NORMAL";
  return "LOW";
}

function classifyChainHealth(
  tvlChange7d: number | null,
  volRatio: number | null,
  bridgeDir: string | null
): ChainVolumeSnapshot["chain_health"] {
  const tvlGrowing = (tvlChange7d ?? 0) > 3;
  const tvlShrinking = (tvlChange7d ?? 0) < -5;
  const volHigh = (volRatio ?? 1) > 1.5;
  const bridgeInflow = bridgeDir === "INFLOW";
  const bridgeOutflow = bridgeDir === "OUTFLOW";

  if (tvlGrowing && bridgeInflow) return "GROWING";
  if (tvlShrinking && bridgeOutflow) return "CONTRACTING";
  if (tvlShrinking && volHigh) return "STRESSED"; // high vol + TVL leaving = distribution
  return "STABLE";
}

function buildAlerts(snap: Partial<ChainVolumeSnapshot>, spikeThreshold: number): string[] {
  const alerts: string[] = [];

  if ((snap.dex_volume_ratio ?? 0) >= spikeThreshold) {
    alerts.push(
      `DEX VOLUME SPIKE: ${(snap.dex_volume_ratio ?? 0).toFixed(1)}× 7-day average — unusual activity on Fraxtal`
    );
  }
  if ((snap.tvl_change_7d_pct ?? 0) < -10) {
    alerts.push(
      `TVL OUTFLOW: Fraxtal TVL down ${Math.abs(snap.tvl_change_7d_pct ?? 0).toFixed(1)}% in 7 days`
    );
  }
  if ((snap.tvl_change_7d_pct ?? 0) > 15) {
    alerts.push(
      `TVL INFLOW: Fraxtal TVL up ${(snap.tvl_change_7d_pct ?? 0).toFixed(1)}% in 7 days — capital influx`
    );
  }
  if (snap.bridge_direction === "OUTFLOW" && Math.abs(snap.net_bridge_flow_24h ?? 0) > 500_000) {
    alerts.push(
      `BRIDGE OUTFLOW: $${((Math.abs(snap.net_bridge_flow_24h ?? 0)) / 1e6).toFixed(2)}M leaving Fraxtal via bridges`
    );
  }
  if (snap.chain_health === "STRESSED") {
    alerts.push("CHAIN STRESS: Rising DEX volume + TVL outflow = possible distribution event");
  }

  return alerts;
}

export async function executeJob(
  request: Record<string, any>
): Promise<ExecuteJobResult> {
  const includeProtocols = request.include_protocols !== false;
  const includeBridge = request.include_bridge !== false;
  const includeLending = request.include_lending !== false;
  const spikeThreshold = Number(request.vol_spike_threshold || 2.0);

  try {
    // ── Fetch all data in parallel ──
    const [chainRes, dexRes, feesRes, stableRes, bridgeRes, protocolRes] =
      await Promise.all([
        fetch(`${DEFILLAMA_BASE}/v2/chains`),
        fetch(
          `${DEFILLAMA_BASE}/overview/dexs/${FRAXTAL_CHAIN}?excludeTotalDataChart=false&dataType=dailyVolume`
        ),
        fetch(
          `${DEFILLAMA_BASE}/overview/fees/${FRAXTAL_CHAIN}?excludeTotalDataChart=true&dataType=dailyFees`
        ),
        fetch(`${DEFILLAMA_BASE}/stablecoins?includePrices=true`),
        includeBridge
          ? fetch(`${DEFILLAMA_BASE}/bridges?includeChains=true`)
          : Promise.resolve(null),
        includeProtocols
          ? fetch(`${DEFILLAMA_BASE}/protocols`)
          : Promise.resolve(null),
      ]);

    // ── Chain TVL ──
    let fraxtalTvl = 0;
    let tvlChange1d: number | null = null;
    let tvlChange7d: number | null = null;

    if (chainRes.ok) {
      const chains: any[] = await chainRes.json();
      const fraxtal = chains.find(
        (c) => c.name?.toLowerCase() === "fraxtal"
      );
      if (fraxtal) {
        fraxtalTvl = fraxtal.tvl || 0;
        tvlChange1d = fraxtal.change_1d ?? null;
        tvlChange7d = fraxtal.change_7d ?? null;
      }
    }

    // ── DEX Volume ──
    let dexVol24h: number | null = null;
    let dexVol7dAvg: number | null = null;
    let dexVolRatio: number | null = null;
    const protocolVolumes: ProtocolVolume[] = [];

    if (dexRes.ok) {
      const dexData = await dexRes.json();
      dexVol24h = dexData.total24h ?? null;

      // 7-day avg from chart data
      if (dexData.totalDataChart && dexData.totalDataChart.length >= 7) {
        const last7 = dexData.totalDataChart.slice(-7);
        const sum = last7.reduce(
          (acc: number, d: [number, number]) => acc + (d[1] || 0),
          0
        );
        dexVol7dAvg = sum / 7;
        dexVolRatio =
          dexVol7dAvg > 0 && dexVol24h != null
            ? dexVol24h / dexVol7dAvg
            : null;
      }

      // Per-protocol volumes
      if (includeProtocols && dexData.protocols) {
        for (const p of dexData.protocols.slice(0, 10)) {
          const vol24 = p.total24h || 0;
          const vol7arr = p.totalDataChart?.slice(-7) || [];
          const vol7avg =
            vol7arr.length > 0
              ? vol7arr.reduce(
                  (s: number, d: [number, number]) => s + (d[1] || 0),
                  0
                ) / vol7arr.length
              : vol24;
          const ratio = vol7avg > 0 ? vol24 / vol7avg : 1;
          protocolVolumes.push({
            name: p.name,
            category: p.category || "DEX",
            volume_24h: vol24,
            volume_7d_avg: Math.round(vol7avg),
            volume_ratio: Math.round(ratio * 100) / 100,
            tvl: p.tvl || 0,
            volume_tvl_ratio:
              p.tvl > 0 ? Math.round((vol24 / p.tvl) * 10000) / 100 : 0,
            signal: classifyVolSignal(ratio),
          });
        }
        protocolVolumes.sort((a, b) => b.volume_24h - a.volume_24h);
      }
    }

    // ── Fee Revenue ──
    let feeRevenue24h: number | null = null;
    if (feesRes.ok) {
      const feesData = await feesRes.json();
      feeRevenue24h = feesData.total24h ?? null;
    }

    // ── Stablecoin (FRAX on Fraxtal) ──
    let stableCirculating: number | null = null;
    let stableChange7d: number | null = null;

    if (stableRes.ok) {
      const stableData = await stableRes.json();
      let fraxtalStableTotal = 0;
      if (stableData.peggedAssets) {
        for (const asset of stableData.peggedAssets) {
          const fraxtalData =
            asset.chainCirculating?.Fraxtal ||
            asset.chainCirculating?.fraxtal;
          if (fraxtalData) {
            fraxtalStableTotal +=
              fraxtalData.current?.peggedUSD || 0;
          }
        }
        stableCirculating =
          fraxtalStableTotal > 0 ? fraxtalStableTotal : null;
      }
    }

    // ── Bridge Flows ──
    const bridgeFlows: BridgeFlow[] = [];
    let netBridgeFlow: number | null = null;
    let bridgeDirection: ChainVolumeSnapshot["bridge_direction"] = null;

    if (includeBridge && bridgeRes?.ok) {
      try {
        const bridgeData = await bridgeRes.json();
        const fraxtalBridges = (bridgeData.bridges || []).filter(
          (b: any) =>
            (b.chains || [])
              .map((c: string) => c.toLowerCase())
              .includes("fraxtal")
        );

        let totalIn = 0;
        let totalOut = 0;

        for (const b of fraxtalBridges.slice(0, 5)) {
          const inflow = b.lastDayUsdTokenVolume || 0;
          const outflow = b.lastDayUsdTokenOutflowVolume || 0;
          const net = inflow - outflow;
          totalIn += inflow;
          totalOut += outflow;

          bridgeFlows.push({
            protocol: b.displayName || b.name,
            inflow_24h: Math.round(inflow),
            outflow_24h: Math.round(outflow),
            net_flow_24h: Math.round(net),
            flow_direction:
              net > 50_000
                ? "INFLOW"
                : net < -50_000
                ? "OUTFLOW"
                : "BALANCED",
          });
        }

        netBridgeFlow = Math.round(totalIn - totalOut);
        bridgeDirection =
          netBridgeFlow > 100_000
            ? "INFLOW"
            : netBridgeFlow < -100_000
            ? "OUTFLOW"
            : "BALANCED";
      } catch (_) {}
    }

    // ── Lending (Fraxlend) from protocols ──
    const lendingMetrics: LendingMetrics[] = [];
    if (includeLending && protocolRes?.ok) {
      try {
        const allProtos: any[] = await protocolRes.json();
        const fraxtalLending = allProtos.filter(
          (p) =>
            (p.chains || [])
              .map((c: string) => c.toLowerCase())
              .includes("fraxtal") && p.category === "Lending"
        );

        for (const p of fraxtalLending.slice(0, 5)) {
          const supplied = p.tvl || 0;
          const borrowed = p.totalBorrowUsd || 0;
          const utilization =
            supplied > 0 ? (borrowed / supplied) * 100 : 0;

          lendingMetrics.push({
            protocol: p.name,
            total_borrowed: Math.round(borrowed),
            total_supplied: Math.round(supplied),
            utilization_pct: Math.round(utilization * 10) / 10,
            borrow_apy: p.borrowApy ?? null,
            supply_apy: p.apyBase ?? null,
            utilization_signal:
              utilization > 85
                ? "OVERCROWDED"
                : utilization > 30
                ? "HEALTHY"
                : "UNDERUTILIZED",
          });
        }
      } catch (_) {}
    }

    // ── Assemble snapshot ──
    const volTvlRatio =
      fraxtalTvl > 0 && dexVol24h != null
        ? Math.round((dexVol24h / fraxtalTvl) * 10000) / 100
        : null;

    const volRegime: ChainVolumeSnapshot["vol_regime"] =
      (dexVolRatio ?? 1) >= 2.5
        ? "SPIKE"
        : (dexVolRatio ?? 1) >= 1.4
        ? "ELEVATED"
        : (dexVolRatio ?? 1) >= 0.6
        ? "NORMAL"
        : "QUIET";

    const chainHealth = classifyChainHealth(
      tvlChange7d,
      dexVolRatio,
      bridgeDirection
    );

    const partialSnap: Partial<ChainVolumeSnapshot> = {
      tvl_change_7d_pct: tvlChange7d,
      dex_volume_ratio: dexVolRatio,
      net_bridge_flow_24h: netBridgeFlow,
      bridge_direction: bridgeDirection,
      chain_health: chainHealth,
    };

    const alerts = buildAlerts(partialSnap, spikeThreshold);

    const snapshot: ChainVolumeSnapshot = {
      chain: FRAXTAL_CHAIN,
      snapshot_at: new Date().toISOString(),
      tvl_usd: fraxtalTvl,
      tvl_change_1d_pct: tvlChange1d != null ? Math.round(tvlChange1d * 10) / 10 : null,
      tvl_change_7d_pct: tvlChange7d != null ? Math.round(tvlChange7d * 10) / 10 : null,
      dex_volume_24h: dexVol24h,
      dex_volume_7d_avg: dexVol7dAvg ? Math.round(dexVol7dAvg) : null,
      dex_volume_ratio: dexVolRatio ? Math.round(dexVolRatio * 100) / 100 : null,
      fee_revenue_24h: feeRevenue24h,
      volume_tvl_ratio: volTvlRatio,
      stablecoin_circulating: stableCirculating,
      stablecoin_change_7d: stableChange7d,
      net_bridge_flow_24h: netBridgeFlow,
      bridge_direction: bridgeDirection,
      vol_regime: volRegime,
      chain_health: chainHealth,
      alerts,
    };

    const summary =
      `Fraxtal: TVL $${(fraxtalTvl / 1e6).toFixed(1)}M ` +
      (tvlChange7d != null
        ? `(${tvlChange7d > 0 ? "+" : ""}${tvlChange7d.toFixed(1)}% 7D)`
        : "") +
      `. DEX vol: $${dexVol24h != null ? (dexVol24h / 1e3).toFixed(0) + "K" : "?"}/24h` +
      (dexVolRatio != null ? ` (${dexVolRatio.toFixed(1)}× avg)` : "") +
      `. Health: ${chainHealth}. Vol regime: ${volRegime}.` +
      (alerts.length > 0 ? ` ${alerts.length} alert(s).` : "");

    return {
      deliverable: JSON.stringify({
        schema: "tracking_fraxtal_volume",
        ...snapshot,
        summary,
        protocol_volumes: protocolVolumes,
        bridge_flows: bridgeFlows,
        lending_metrics: lendingMetrics,
      }),
    };
  } catch (e: any) {
    return {
      deliverable: JSON.stringify({
        schema: "tracking_fraxtal_volume",
        error: `Fraxtal volume tracking failed: ${e.message}`,
        chain: FRAXTAL_CHAIN,
      }),
    };
  }
}
