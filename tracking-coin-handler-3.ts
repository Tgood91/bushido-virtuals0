import type { ExecuteJobResult } from "../../../runtime/offeringTypes.js";

/**
 * Seykota Agent Job: Tracking Coin Schema
 * cron: "*/30 * * * *"  — Every 30 minutes
 *
 * Deep per-coin tracking: price, momentum, trend score, on-chain activity,
 * social sentiment signals, and vol-farming-specific metrics (IV proxy,
 * historical vol, funding rate). The agent's per-asset intelligence profile.
 *
 * Example request:
 * {
 *   "coin_id": "ethereum",         // CoinGecko ID
 *   "include_market_chart": true,  // fetch 7-day OHLC for RV calc
 *   "include_developer": false,    // fetch GitHub commit activity
 * }
 */

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const CG_KEY = process.env.COINGECKO_API_KEY || "";

interface PriceCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface TrendScore {
  score: number;         // -7 to +7 (Seykota EMA scoring)
  label: string;
  signals: Record<string, boolean>;
}

interface VolMetrics {
  realized_vol_7d: number;      // annualized %
  high_low_range_7d: number;    // max drawdown in window
  avg_daily_range: number;      // avg (high-low)/close %
  vol_regime: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
}

function calcEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calcRealizedVol(closes: number[]): number {
  if (closes.length < 2) return 0;
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
    (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(365) * 100; // annualized %
}

function calcATR(candles: PriceCandle[]): number {
  if (candles.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - prevClose),
      Math.abs(candles[i].low - prevClose)
    );
    trs.push(tr);
  }
  return trs.reduce((a, b) => a + b, 0) / trs.length;
}

function scoreTrend(
  price: number,
  closes: number[]
): TrendScore {
  if (closes.length < 50) {
    return { score: 0, label: "INSUFFICIENT_DATA", signals: {} };
  }

  const ema10 = calcEMA(closes, 10);
  const ema20 = calcEMA(closes, 20);
  const ema50 = calcEMA(closes, 50);

  const last10 = ema10[ema10.length - 1];
  const last20 = ema20[ema20.length - 1];
  const last50 = ema50[ema50.length - 1];

  const signals = {
    "price_gt_ema10_daily": price > last10,
    "price_gt_ema20_daily": price > last20,
    "price_gt_ema50_daily": price > last50,
    "ema10_gt_ema20_daily": last10 > last20,
    "ema10_gt_ema50_daily": last10 > last50,
  };

  const score = Object.values(signals).reduce(
    (sum, v) => sum + (v ? 1 : -1),
    0
  );

  const label =
    score >= 5
      ? "STRONG_UPTREND"
      : score >= 3
      ? "UPTREND"
      : score >= 0
      ? "NEUTRAL"
      : score >= -3
      ? "DOWNTREND"
      : "STRONG_DOWNTREND";

  return { score, label, signals };
}

function buildVolMetrics(candles: PriceCandle[]): VolMetrics {
  const closes = candles.map((c) => c.close);
  const rv = calcRealizedVol(closes);
  const allHighs = candles.map((c) => c.high);
  const allLows = candles.map((c) => c.low);
  const maxHigh = Math.max(...allHighs);
  const minLow = Math.min(...allLows);
  const hlRange = minLow > 0 ? ((maxHigh - minLow) / minLow) * 100 : 0;

  const dailyRanges = candles.map((c) =>
    c.close > 0 ? ((c.high - c.low) / c.close) * 100 : 0
  );
  const avgDailyRange =
    dailyRanges.reduce((a, b) => a + b, 0) / dailyRanges.length;

  const volRegime: VolMetrics["vol_regime"] =
    rv > 150
      ? "EXTREME"
      : rv > 80
      ? "HIGH"
      : rv > 40
      ? "MEDIUM"
      : "LOW";

  return {
    realized_vol_7d: Math.round(rv * 10) / 10,
    high_low_range_7d: Math.round(hlRange * 10) / 10,
    avg_daily_range: Math.round(avgDailyRange * 100) / 100,
    vol_regime: volRegime,
  };
}

export async function executeJob(
  request: Record<string, any>
): Promise<ExecuteJobResult> {
  const coinId: string =
    request.coin_id || request.id || request.token || "ethereum";
  const includeChart = request.include_market_chart !== false;
  const includeDev = request.include_developer === true;

  const cgHeaders: Record<string, string> = {
    ...(CG_KEY ? { "x-cg-demo-api-key": CG_KEY } : {}),
  };

  try {
    // ── Fetch core coin data ──
    const detailFields = [
      "id", "symbol", "name", "market_data",
      "developer_data", "community_data", "description",
      "categories", "links",
    ].join(",");

    const [detailRes, chartRes] = await Promise.all([
      fetch(
        `${COINGECKO_BASE}/coins/${coinId}?localization=false&tickers=false` +
          `&market_data=true&community_data=true&developer_data=${includeDev}` +
          `&sparkline=false`,
        { headers: cgHeaders }
      ),
      includeChart
        ? fetch(
            `${COINGECKO_BASE}/coins/${coinId}/ohlc?vs_currency=usd&days=30`,
            { headers: cgHeaders }
          )
        : Promise.resolve(null),
    ]);

    if (!detailRes.ok) {
      throw new Error(`CoinGecko coin detail: ${detailRes.status} — check coin_id "${coinId}"`);
    }

    const detail = await detailRes.json();
    const md = detail.market_data || {};

    // ── Parse OHLC candles ──
    let candles: PriceCandle[] = [];
    if (chartRes?.ok) {
      const raw: [number, number, number, number, number][] =
        await chartRes.json();
      candles = raw.map(([ts, o, h, l, c]) => ({
        timestamp: ts,
        open: o,
        high: h,
        low: l,
        close: c,
      }));
    }

    const closes = candles.map((c) => c.close);
    const currentPrice: number = md.current_price?.usd || 0;

    // ── Compute derived metrics ──
    const trendScore = closes.length >= 10 ? scoreTrend(currentPrice, closes) : null;
    const atr = candles.length >= 14 ? calcATR(candles.slice(-14)) : null;
    const volMetrics = candles.length >= 7 ? buildVolMetrics(candles.slice(-7)) : null;

    // ── Momentum ──
    const mom5d = md.price_change_percentage_14d?.usd ?? null;  // proxy
    const mom30d = md.price_change_percentage_30d?.usd ?? null;

    // ── Stop levels (2×ATR) ──
    const longStop = atr ? currentPrice - 2 * atr : null;
    const shortStop = atr ? currentPrice + 2 * atr : null;

    // ── Position sizing hint (1% risk on $10K account) ──
    const riskDollars = 100; // 1% of $10K default
    const stopDistance = atr ? 2 * atr : currentPrice * 0.05;
    const suggestedUnits = stopDistance > 0 ? riskDollars / stopDistance : 0;
    const suggestedNotional = suggestedUnits * currentPrice;

    // ── Summary ──
    const summary =
      `${detail.symbol?.toUpperCase()} ($${currentPrice.toLocaleString()}) — ` +
      (trendScore
        ? `Trend: ${trendScore.label} (${trendScore.score > 0 ? "+" : ""}${trendScore.score}/5). `
        : "") +
      (volMetrics ? `RV 7D: ${volMetrics.realized_vol_7d}% annualized (${volMetrics.vol_regime}). ` : "") +
      (atr ? `ATR: $${atr.toFixed(2)}. ` : "") +
      `24H: ${(md.price_change_percentage_24h?.usd ?? 0).toFixed(2)}%, ` +
      `7D: ${(md.price_change_percentage_7d?.usd ?? 0).toFixed(2)}%.`;

    return {
      deliverable: JSON.stringify({
        schema: "tracking_coin",
        tracked_at: new Date().toISOString(),
        coin_id: coinId,
        symbol: detail.symbol?.toUpperCase(),
        name: detail.name,
        summary,

        // Price
        price: {
          current_usd: currentPrice,
          ath_usd: md.ath?.usd,
          ath_change_pct: md.ath_change_percentage?.usd,
          atl_usd: md.atl?.usd,
          change_1h: md.price_change_percentage_1h_in_currency?.usd,
          change_24h: md.price_change_percentage_24h?.usd,
          change_7d: md.price_change_percentage_7d?.usd,
          change_30d: md.price_change_percentage_30d?.usd,
        },

        // Market
        market: {
          market_cap_usd: md.market_cap?.usd,
          fully_diluted_val_usd: md.fully_diluted_valuation?.usd,
          volume_24h_usd: md.total_volume?.usd,
          volume_to_mcap_pct:
            md.market_cap?.usd > 0
              ? ((md.total_volume?.usd / md.market_cap?.usd) * 100).toFixed(2)
              : null,
          circulating_supply: md.circulating_supply,
          total_supply: md.total_supply,
          max_supply: md.max_supply,
        },

        // Trend & technicals
        trend: trendScore,
        technicals: {
          atr_14: atr ? Math.round(atr * 100) / 100 : null,
          long_stop_2atr: longStop ? Math.round(longStop * 100) / 100 : null,
          short_stop_2atr: shortStop ? Math.round(shortStop * 100) / 100 : null,
          suggested_units_per_1pct_risk: Math.round(suggestedUnits * 1000) / 1000,
          suggested_notional_1pct_risk: Math.round(suggestedNotional),
        },

        // Vol metrics
        volatility: volMetrics,

        // Developer (optional)
        developer: includeDev
          ? {
              github_stars: detail.developer_data?.stars,
              github_forks: detail.developer_data?.forks,
              commits_4w: detail.developer_data?.commit_count_4_weeks,
              active_devs: detail.developer_data?.contributors,
            }
          : null,

        // Categories
        categories: detail.categories?.slice(0, 5) || [],
      }),
    };
  } catch (e: any) {
    return {
      deliverable: JSON.stringify({
        schema: "tracking_coin",
        error: `Coin tracking failed: ${e.message}`,
        coin_id: coinId,
      }),
    };
  }
}
