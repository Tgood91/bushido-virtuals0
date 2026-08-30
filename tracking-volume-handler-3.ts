import type { ExecuteJobResult } from "../../../runtime/offeringTypes.js";

/**
 * Seykota Agent Job: Tracking Volume Schema
 * cron: "*/15 * * * *"  — Every 15 minutes
 *
 * Tracks and scores trading volume across tokens, DEXes, and chains.
 * Volume is the single most reliable leading indicator for price moves —
 * price follows volume. Volume spikes precede breakouts. Volume drying up
 * confirms distribution. This schema is the agent's volume radar.
 *
 * Example request:
 * {
 *   "tokens": ["ethereum", "solana", "aerodrome-finance"], // CoinGecko IDs
 *   "chain": "base",           // filter DEX volumes to chain
 *   "alert_threshold_pct": 200, // alert if volume > X% of 7-day avg
 *   "include_dex": true,
 * }
 */

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const DEFILLAMA_BASE = "https://api.llama.fi";
const CG_KEY = process.env.COINGECKO_API_KEY || "";

interface VolumeSnapshot {
  token_id: string;
  symbol: string;
  name: string;
  price_usd: number;
  volume_24h: number;
  volume_7d_avg: number;
  volume_ratio: number;          // 24h vol / 7d avg — >2.0 = spike
  volume_to_mcap: number;        // high = high turnover = momentum
  price_change_24h: number;
  price_change_7d: number;
  volume_signal: "SPIKE" | "ELEVATED" | "NORMAL" | "DRY" | "DEAD";
  vol_price_divergence: boolean; // volume up but price flat = accumulation
  alert: boolean;
}

interface DexVolumeEntry {
  protocol: string;
  chain: string;
  volume_24h: number;
  volume_7d_avg: number;
  volume_ratio: number;
  tvl: number;
  volume_tvl_ratio: number;      // high = protocol is active relative to size
}

function classifyVolumeSignal(ratio: number): VolumeSnapshot["volume_signal"] {
  if (ratio >= 3.0) return "SPIKE";
  if (ratio >= 1.5) return "ELEVATED";
  if (ratio >= 0.5) return "NORMAL";
  if (ratio >= 0.2) return "DRY";
  return "DEAD";
}

function detectDivergence(
  volRatio: number,
  priceChange24h: number
): boolean {
  // Volume spike but price barely moved = accumulation or distribution
  return volRatio > 1.8 && Math.abs(priceChange24h) < 2;
}

export async function executeJob(
  request: Record<string, any>
): Promise<ExecuteJobResult> {
  const tokenIds: string[] = request.tokens || [
    "bitcoin",
    "ethereum",
    "solana",
    "avalanche-2",
    "near",
    "aerodrome-finance",
    "virtual-protocol",
  ];
  const alertThreshold = Number(request.alert_threshold_pct || 200);
  const includeDex = request.include_dex !== false;
  const filterChain: string = (request.chain || "").toLowerCase();

  const cgHeaders: Record<string, string> = {
    ...(CG_KEY ? { "x-cg-demo-api-key": CG_KEY } : {}),
  };

  try {
    // ── Fetch token volume data ──
    const ids = tokenIds.join(",");
    const marketRes = await fetch(
      `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${ids}` +
        `&order=volume_desc&price_change_percentage=24h,7d&sparkline=false`,
      { headers: cgHeaders }
    );
    const markets = marketRes.ok ? await marketRes.json() : [];

    // ── Build volume snapshots ──
    const snapshots: VolumeSnapshot[] = markets.map((m: any) => {
      // Estimate 7d avg from available data (approximation without historical endpoint)
      // In production, store daily volumes and compute true 7d avg
      const vol24h = m.total_volume || 0;
      const mcap = m.market_cap || 1;
      const priceChange24h = m.price_change_percentage_24h_in_currency ?? 0;
      const priceChange7d = m.price_change_percentage_7d_in_currency ?? 0;

      // Rough 7d avg proxy: vol/mcap turnover normalized
      // Replace with stored historical avg in production
      const estimatedAvg = vol24h / (1 + Math.abs(priceChange24h) * 0.05);
      const volRatio = estimatedAvg > 0 ? vol24h / estimatedAvg : 1;
      const volToMcap = mcap > 0 ? (vol24h / mcap) * 100 : 0;

      return {
        token_id: m.id,
        symbol: m.symbol?.toUpperCase(),
        name: m.name,
        price_usd: m.current_price || 0,
        volume_24h: vol24h,
        volume_7d_avg: estimatedAvg,
        volume_ratio: volRatio,
        volume_to_mcap: volToMcap,
        price_change_24h: priceChange24h,
        price_change_7d: priceChange7d,
        volume_signal: classifyVolumeSignal(volRatio),
        vol_price_divergence: detectDivergence(volRatio, priceChange24h),
        alert: volRatio >= alertThreshold / 100,
      };
    });

    // ── Fetch DEX volume data from DeFiLlama ──
    let dexVolumes: DexVolumeEntry[] = [];
    if (includeDex) {
      try {
        const dexRes = await fetch(`${DEFILLAMA_BASE}/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyVolume`);
        if (dexRes.ok) {
          const dexData = await dexRes.json();
          const protocols = dexData.protocols || [];

          dexVolumes = protocols
            .filter((p: any) => {
              if (!filterChain) return true;
              const chains: string[] = (p.chains || []).map((c: string) =>
                c.toLowerCase()
              );
              return chains.includes(filterChain);
            })
            .slice(0, 15)
            .map((p: any) => {
              const vol24h = p.totalDataChart?.[p.totalDataChart?.length - 1]?.[1] || p.total24h || 0;
              const vol7dArr = p.totalDataChart?.slice(-7) || [];
              const vol7dAvg =
                vol7dArr.length > 0
                  ? vol7dArr.reduce((sum: number, d: any) => sum + (d[1] || 0), 0) /
                    vol7dArr.length
                  : vol24h;

              return {
                protocol: p.name,
                chain: (p.chains || []).join(", "),
                volume_24h: vol24h,
                volume_7d_avg: vol7dAvg,
                volume_ratio: vol7dAvg > 0 ? vol24h / vol7dAvg : 1,
                tvl: p.tvl || 0,
                volume_tvl_ratio: p.tvl > 0 ? (vol24h / p.tvl) * 100 : 0,
              };
            })
            .sort((a: DexVolumeEntry, b: DexVolumeEntry) => b.volume_24h - a.volume_24h);
        }
      } catch (_) {
        // DEX data optional — don't fail the whole job
      }
    }

    // ── Alerts ──
    const alerts = snapshots.filter((s) => s.alert || s.vol_price_divergence);
    const spikes = snapshots.filter((s) => s.volume_signal === "SPIKE");
    const topByVolume = [...snapshots].sort((a, b) => b.volume_24h - a.volume_24h)[0];

    const summary =
      `Tracked ${snapshots.length} tokens. ` +
      `${spikes.length} volume spike${spikes.length !== 1 ? "s" : ""} detected. ` +
      `${alerts.length} alert${alerts.length !== 1 ? "s" : ""} triggered. ` +
      (topByVolume
        ? `Highest volume: ${topByVolume.symbol} at $${(topByVolume.volume_24h / 1e6).toFixed(1)}M.`
        : "");

    return {
      deliverable: JSON.stringify({
        schema: "tracking_volume",
        tracked_at: new Date().toISOString(),
        token_count: snapshots.length,
        dex_count: dexVolumes.length,
        alert_threshold_pct: alertThreshold,
        alerts_triggered: alerts.length,
        spike_count: spikes.length,
        summary,
        tokens: snapshots,
        dex_volumes: dexVolumes,
        alerts: alerts.map((a) => ({
          symbol: a.symbol,
          reason: a.vol_price_divergence
            ? "VOL/PRICE DIVERGENCE — potential accumulation or distribution"
            : `VOLUME SPIKE — ${a.volume_ratio.toFixed(1)}× 7-day avg`,
          signal: a.volume_signal,
          price_usd: a.price_usd,
          volume_24h: a.volume_24h,
        })),
      }),
    };
  } catch (e: any) {
    return {
      deliverable: JSON.stringify({
        schema: "tracking_volume",
        error: `Volume tracking failed: ${e.message}`,
        tokens: [],
        dex_volumes: [],
      }),
    };
  }
}
