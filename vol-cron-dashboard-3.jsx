import { useState } from "react";

// ─── CRON JOB DEFINITIONS ────────────────────────────────────────────────────
const CRON_JOBS = [

  // ══════════════════════════════════════════════════════
  // TIER 1: HIGH-FREQUENCY — Market Microstructure
  // ══════════════════════════════════════════════════════
  {
    id: "vol-pulse",
    tier: 1,
    category: "Volatility Core",
    name: "Realized Volatility Pulse",
    cron: "*/5 * * * *",
    human: "Every 5 minutes",
    description: "Calculate 5-min realized vol (RV) across BTC, ETH, SOL, and Base ecosystem tokens. Compare to implied vol (IV) from options markets. The IV-RV spread is the single most important signal in vol trading — positive spread = options overpriced, negative = underpriced.",
    signals: ["IV > RV → sell vol (short straddle/strangle)", "RV > IV → buy vol (long gamma)", "Spread compression → mean reversion imminent"],
    variables: ["DVOL (Deribit Vol Index)", "ATM IV from options chain", "5-min OHLC for RV calc", "Bid-ask spread on options"],
    risk: "HIGH",
    action: "SCAN + ALERT",
    color: "#ff4466",
  },
  {
    id: "funding-tick",
    tier: 1,
    category: "Funding & Basis",
    name: "Perpetual Funding Rate Tick",
    cron: "*/8 * * * *",
    human: "Every 8 minutes",
    description: "Poll funding rates across all perp venues (Hyperliquid, dYdX, GMX, Vertex). Extreme funding (>0.1%/8h annualizes to 450%+) signals crowded positioning. This is the basis for delta-neutral farming: hold spot long + perp short to harvest funding while staying flat.",
    signals: ["Funding > 0.1% → delta-neutral farm opportunity", "Funding < -0.05% → reverse farm (spot short + long perp)", "Divergence across venues → arbitrage"],
    variables: ["8h funding rate per venue", "Open interest", "Longs/shorts ratio", "Predicted next funding"],
    risk: "MEDIUM",
    action: "FARM + REBALANCE",
    color: "#ffaa00",
  },
  {
    id: "gamma-exposure",
    tier: 1,
    category: "Options Flow",
    name: "GEX — Gamma Exposure Scan",
    cron: "*/15 * * * *",
    human: "Every 15 minutes",
    description: "Track dealer gamma exposure (GEX) at key strikes. Positive GEX = dealers long gamma = they sell rallies/buy dips = suppressed volatility. Negative GEX = dealers short gamma = they chase moves = volatility amplification. GEX flips are the most reliable vol regime change signal.",
    signals: ["GEX > 0 → range-bound, sell vol", "GEX < 0 → trending, buy vol", "GEX zero-cross → regime change, reduce size"],
    variables: ["Open interest by strike", "Delta per strike", "Dealer positioning estimate", "Put/call ratio"],
    risk: "HIGH",
    action: "REGIME DETECT",
    color: "#ff4466",
  },

  // ══════════════════════════════════════════════════════
  // TIER 2: HOURLY — Core Vol Farming Logic
  // ══════════════════════════════════════════════════════
  {
    id: "iv-surface",
    tier: 2,
    category: "Volatility Core",
    name: "IV Surface Refresh",
    cron: "0 * * * *",
    human: "Every hour",
    description: "Reconstruct the full implied volatility surface: IV by strike (skew) and IV by expiry (term structure). Vol skew tells you fear vs. greed — put skew high = market fears crash. Term structure steep = near-term fear, flat = complacency. These are your pricing inputs for all vol positions.",
    signals: ["Steep put skew → buy upside calls (cheap)", "Backwardation in term structure → near-term vol event expected", "Flat surface → mean reversion setup"],
    variables: ["25-delta put/call skew", "ATM IV by expiry (1W/2W/1M/3M)", "Vol of vol (VoV)", "Skew slope"],
    risk: "MEDIUM",
    action: "REPRICE POSITIONS",
    color: "#ffaa00",
  },
  {
    id: "lp-range-health",
    tier: 2,
    category: "Liquidity Mining",
    name: "LP Range Health Check",
    cron: "0 * * * *",
    human: "Every hour",
    description: "Monitor all concentrated liquidity positions (Uniswap V3/V4, Aerodrome, Camelot). Track: are positions in-range? What % of time in-range over last 24h? Fee APR vs. impermanent loss rate? The volatility farmer's core challenge: high vol = high fees BUT high IL. Narrow ranges = max fees but frequent out-of-range.",
    signals: ["Position out of range → rebalance or widen", "IL > fee income → exit or hedge", "Fee APR > 200% → maintain range"],
    variables: ["Current price vs. range bounds", "Fee income (24h)", "IL since entry", "Time in-range %", "Volume/TVL ratio"],
    risk: "MEDIUM",
    action: "REBALANCE or EXIT",
    color: "#ffaa00",
  },
  {
    id: "vega-pnl",
    tier: 2,
    category: "Options Flow",
    name: "Vega P&L Attribution",
    cron: "30 * * * *",
    human: "Every hour at :30",
    description: "Decompose options P&L into greek components: delta P&L (directional), gamma P&L (realized vol capture), theta P&L (time decay earned/paid), vega P&L (IV change). A vol seller's ideal day: theta earned > gamma bled. A vol buyer's ideal day: gamma earned > theta paid. This is your scorecard.",
    signals: ["Gamma > theta → long vol position working", "Theta > gamma → short vol position working", "Vega loss > 2× theta earned → close short vol"],
    variables: ["Daily theta decay", "Realized gamma P&L", "Vega exposure", "Net greek P&L"],
    risk: "LOW",
    action: "MONITOR + LOG",
    color: "#00ff88",
  },
  {
    id: "defi-yield-arb",
    tier: 2,
    category: "Yield Farming",
    name: "DeFi Yield Arbitrage Scan",
    cron: "15 */2 * * *",
    human: "Every 2 hours at :15",
    description: "Compare annualized yields across all yield sources: lending (Aave, Morpho, Compound), LP fees, staking rewards, funding farming. Account for token emission dilution, smart contract risk, and opportunity cost. The vol farmer always asks: is this risk-adjusted yield better than just being long gamma?",
    signals: ["Yield > 50% APR with blue-chip risk → allocate", "Emission token >70% of yield → discount heavily", "Yield compression → rotate capital"],
    variables: ["Base APY (fees only)", "Reward APY (token emissions)", "TVL trend (increasing = yield compression)", "Protocol TVL vs. 30-day avg"],
    risk: "MEDIUM",
    action: "ROTATE CAPITAL",
    color: "#ffaa00",
  },

  // ══════════════════════════════════════════════════════
  // TIER 3: 4-HOURLY — Regime & Structure
  // ══════════════════════════════════════════════════════
  {
    id: "vol-regime",
    tier: 3,
    category: "Volatility Core",
    name: "Volatility Regime Classifier",
    cron: "0 */4 * * *",
    human: "Every 4 hours",
    description: "Classify current vol regime using multiple indicators: VIX analog (DVOL), realized vol percentile (1Y lookback), vol momentum (is vol rising or falling?), and correlation across assets. 4 regimes: LOW-VOL (sell premium), RISING-VOL (buy gamma, reduce LP), HIGH-VOL (harvest premium carefully), CRASH (extreme dislocations, best opportunities).",
    signals: ["DVOL < 40 → LOW regime, sell straddles", "DVOL 40-70 → RISING, buy gamma", "DVOL > 80 → HIGH, sell wings only", "DVOL spike >50% in 4h → CRASH, max opportunity"],
    variables: ["DVOL level and 30-day percentile", "Realized vol 5/20/60 day", "Vol momentum (d/dt of IV)", "Cross-asset correlation"],
    risk: "LOW",
    action: "REGIME SHIFT",
    color: "#00ff88",
  },
  {
    id: "delta-neutral-rebal",
    tier: 3,
    category: "Funding & Basis",
    name: "Delta-Neutral Rebalance",
    cron: "0 */4 * * *",
    human: "Every 4 hours",
    description: "Rebalance delta-neutral funding farms. Spot/perp basis drifts as price moves — a $10K ETH position with 1× short perp becomes net long if ETH pumps 10%. Check delta exposure across all positions, execute rebalancing trades if delta exceeds ±2% of NAV. This is the mechanical core of basis trading.",
    signals: ["Net delta > +2% NAV → sell perp to flatten", "Net delta < -2% NAV → buy perp to flatten", "Funding flipped negative → consider unwinding farm"],
    variables: ["Spot holdings by asset", "Perp position sizes", "Net delta (USD)", "Cumulative funding earned", "Rebalance cost vs. funding earned"],
    risk: "MEDIUM",
    action: "REBALANCE DELTA",
    color: "#ffaa00",
  },
  {
    id: "liquidity-depth",
    tier: 3,
    category: "Liquidity Mining",
    name: "Market Depth & Slippage Scan",
    cron: "0 2,6,10,14,18,22 * * *",
    human: "Every 4 hours at fixed UTC times",
    description: "Measure order book depth and slippage across DEX/CEX venues. Thin liquidity = high slippage costs eating your edge. Also: correlate liquidity with volatility — liquidity dries up right before major moves. Monitoring this protects LP positions and signals when to tighten/widen ranges proactively.",
    signals: ["Depth -30% vs 7-day avg → pre-move warning", "Bid-ask spread widening → vol about to spike", "DEX/CEX vol divergence → arbitrage window"],
    variables: ["Order book depth ±1%/2%/5%", "DEX pool depth", "Bid-ask spread", "Volume vs. 7-day avg"],
    risk: "LOW",
    action: "ALERT + WIDEN RANGES",
    color: "#00ff88",
  },

  // ══════════════════════════════════════════════════════
  // TIER 4: DAILY — Strategic Layer
  // ══════════════════════════════════════════════════════
  {
    id: "term-structure-roll",
    tier: 4,
    category: "Options Flow",
    name: "Term Structure Roll Analysis",
    cron: "0 8 * * *",
    human: "Daily at 08:00 UTC",
    description: "Analyze options roll cost/benefit. As options approach expiry, gamma accelerates (good for long gamma) and theta accelerates (good for short gamma). Rolling short positions forward captures fresh theta but costs bid-ask spread. Rolling long positions avoids theta cliff but costs premium. This daily check decides: roll, close, or hold to expiry.",
    signals: ["DTE < 7 → evaluate roll for short positions", "Vol term structure backwardated → don't roll, let expire", "Next expiry has major event → roll past it"],
    variables: ["DTE for all positions", "Roll cost (bid-ask × 2)", "IV differential (front vs. back month)", "Upcoming events (FOMC, CPI, expiry)"],
    risk: "LOW",
    action: "ROLL DECISION",
    color: "#00ff88",
  },
  {
    id: "il-hedge-review",
    tier: 4,
    category: "Liquidity Mining",
    name: "Impermanent Loss Hedge Review",
    cron: "0 9 * * *",
    human: "Daily at 09:00 UTC",
    description: "Review IL hedge effectiveness. Common hedges: buy OTM options to cap downside IL, use Gamma strategies (Arrakis, Bunni), or simply widen ranges. Calculate actual IL vs. hedged IL vs. fee income. The vol farmer's paradox: high vol creates high fees AND high IL. The hedge cost must be < IL saved.",
    signals: ["IL > 5% with no hedge → add protection", "Hedge cost > fee income → remove hedge", "Price near range boundary → preemptive rebalance"],
    variables: ["Actual IL (USD)", "Hedge cost (premium paid)", "Net fee income", "Expected IL at current vol", "Range width vs. daily range"],
    risk: "MEDIUM",
    action: "HEDGE REVIEW",
    color: "#ffaa00",
  },
  {
    id: "corr-breakdown",
    tier: 4,
    category: "Volatility Core",
    name: "Correlation Breakdown Monitor",
    cron: "0 10 * * *",
    human: "Daily at 10:00 UTC",
    description: "Track rolling 30-day correlations across major assets (BTC/ETH/SOL/Gold/Equities). Correlation spikes to 1.0 during crashes (everything falls together). Correlation breakdown = diversification restored = safer to run multiple positions. Correlation is the hidden risk multiplier — two 'uncorrelated' positions become one during stress.",
    signals: ["BTC/ETH corr > 0.95 → treat as one position for risk", "Crypto/equities corr rising → macro risk-off incoming", "Correlation breakdown → increase position diversity"],
    variables: ["30-day rolling correlation matrix", "Correlation vs. 1Y avg", "Cross-asset beta", "Correlation vol (how stable is the corr?)"],
    risk: "LOW",
    action: "RISK SIZING",
    color: "#00ff88",
  },
  {
    id: "token-emission-watch",
    tier: 4,
    category: "Yield Farming",
    name: "Token Emission & Unlock Watch",
    cron: "0 7 * * *",
    human: "Daily at 07:00 UTC",
    description: "Track upcoming token unlocks, emission schedule changes, and governance votes that affect yield. Token emissions are the vol farmer's hidden enemy — they dilute reward token value faster than fees accrue. A 200% APR protocol with 5% weekly emissions loses half its token value in 14 weeks.",
    signals: ["Large unlock (<7 days) → reduce LP in that token", "Emission rate cut → yield drops, exit early", "veToken vote → check if your pool loses gauge weight"],
    variables: ["Emission schedule", "Unlock calendar", "veToken gauge weights", "Token price vs. emission rate", "Real yield (fees only, no emissions)"],
    risk: "MEDIUM",
    action: "ROTATE or REDUCE",
    color: "#ffaa00",
  },
  {
    id: "pnl-attribution",
    tier: 4,
    category: "Risk Management",
    name: "Daily P&L Attribution",
    cron: "0 23 * * *",
    human: "Daily at 23:00 UTC",
    description: "Full daily P&L breakdown: realized vs. unrealized, by strategy (vol selling, LP farming, funding), by greek (delta/gamma/theta/vega), and by asset. Identifies which strategies are working and which are bleeding. The vol trader who doesn't attribute P&L will keep doubling down on losing strategies without knowing it.",
    signals: ["Strategy P&L negative 3 days straight → reduce size 50%", "One asset driving 80%+ of P&L → concentration risk", "Theta earned < expected → check position sizing"],
    variables: ["Realized P&L", "Unrealized P&L", "Fees earned", "Funding earned", "IL incurred", "Gas costs"],
    risk: "LOW",
    action: "LOG + ADJUST",
    color: "#00ff88",
  },

  // ══════════════════════════════════════════════════════
  // TIER 5: WEEKLY — Portfolio Architecture
  // ══════════════════════════════════════════════════════
  {
    id: "vol-surface-calibration",
    tier: 5,
    category: "Volatility Core",
    name: "Vol Model Recalibration",
    cron: "0 6 * * 1",
    human: "Every Monday at 06:00 UTC",
    description: "Recalibrate vol models with fresh realized data. Update: (1) GARCH parameters for RV forecasting, (2) mean-reversion speed of IV, (3) skew dynamics model, (4) jump frequency estimates. Models drift from reality — a weekly recalibration ensures your IV forecasts stay accurate. Stale models = mispriced options = edge erosion.",
    signals: ["Model IV vs. market IV diverging > 5 vol pts → recalibrate", "RV forecast error rising → update GARCH params", "Skew dynamics shifted → adjust delta hedges"],
    variables: ["Historical RV (5/20/60 day)", "GARCH(1,1) parameters", "Skew slope regression", "Jump frequency (events per month)"],
    risk: "LOW",
    action: "MODEL UPDATE",
    color: "#00ff88",
  },
  {
    id: "portfolio-heat-review",
    tier: 5,
    category: "Risk Management",
    name: "Portfolio Heat & Var Review",
    cron: "0 8 * * 1",
    human: "Every Monday at 08:00 UTC",
    description: "Weekly portfolio risk audit: calculate Value at Risk (VaR 95%/99%), stress test against: -30% BTC crash, +50% vol spike, funding rate reversal, liquidity crisis. A vol farmer with 10 correlated positions during a crash can lose everything in hours. This review enforces position limits and correlation caps before disasters happen.",
    signals: ["VaR 99% > 10% NAV → reduce portfolio heat", "Stress test loss > 20% → add hedges", "Single position > 25% of risk → trim"],
    variables: ["VaR (95% and 99%)", "Stress test scenarios", "Portfolio delta/gamma/vega", "Correlation-adjusted heat", "Max drawdown since inception"],
    risk: "LOW",
    action: "RISK RESET",
    color: "#00ff88",
  },
  {
    id: "protocol-risk-audit",
    tier: 5,
    category: "Yield Farming",
    name: "Smart Contract Risk Audit",
    cron: "0 9 * * 3",
    human: "Every Wednesday at 09:00 UTC",
    description: "Review smart contract risk for all active farming positions: audit recency, TVL trends, admin key risks, oracle dependencies, insurance coverage. DeFi's dirty secret: a 500% APR protocol that gets exploited returns -100% in one transaction. Risk-adjusted yield must discount for hack probability. $1B lost to exploits in 2024 alone.",
    signals: ["Protocol audit > 12 months old → reduce allocation", "TVL dropping fast → exit (smart money leaving)", "Admin key not time-locked → apply 30% discount to yield"],
    variables: ["Last audit date", "TVL trend (7/30 day)", "Admin key structure", "Oracle type", "Insurance coverage", "Bug bounty size"],
    risk: "LOW",
    action: "REALLOCATION",
    color: "#00ff88",
  },
  {
    id: "funding-curve-analysis",
    tier: 5,
    category: "Funding & Basis",
    name: "Funding Curve & Basis Analysis",
    cron: "0 10 * * 5",
    human: "Every Friday at 10:00 UTC",
    description: "Weekly deep analysis of perpetual funding curve: is funding mean-reverting? How long does extreme funding persist? Calculate Sharpe ratio of funding farming vs. alternatives. Also analyze spot-futures basis on CME/Deribit — when annualized basis > 15%, institutional basis trade competes with DeFi funding farms.",
    signals: ["Funding Sharpe < 0.5 → not worth the delta risk", "CME basis > DeFi funding → capital will migrate, farm will compress", "Funding persistence > 7 days → trending regime, farm with larger size"],
    variables: ["90-day funding history", "Funding autocorrelation", "Funding Sharpe ratio", "CME/Deribit basis", "Net funding earned YTD"],
    risk: "LOW",
    action: "STRATEGY REVIEW",
    color: "#00ff88",
  },
];

const CATEGORIES = [...new Set(CRON_JOBS.map(j => j.category))];
const TIERS = [1, 2, 3, 4, 5];
const TIER_LABELS = { 1: "5-15 MIN", 2: "HOURLY", 3: "4-HOURLY", 4: "DAILY", 5: "WEEKLY" };
const RISK_COLOR = { HIGH: "#ff4466", MEDIUM: "#ffaa00", LOW: "#00ff88" };

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function VolCronDashboard() {
  const [selectedTier, setSelectedTier] = useState(null);
  const [selectedCat, setSelectedCat] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [view, setView] = useState("jobs"); // jobs | config

  const filtered = CRON_JOBS.filter(j => {
    if (selectedTier && j.tier !== selectedTier) return false;
    if (selectedCat && j.category !== selectedCat) return false;
    return true;
  });

  const toggle = (id) => setExpanded(prev => prev === id ? null : id);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#060709",
      color: "#d8d8d8",
      fontFamily: "'Courier Prime', 'Courier New', monospace",
    }}>

      {/* ── HEADER ── */}
      <div style={{
        background: "linear-gradient(180deg, #0a0c12 0%, #060709 100%)",
        borderBottom: "1px solid #0f1218",
        padding: "22px 28px 18px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{
              fontSize: 20, fontWeight: 700, letterSpacing: 3,
              color: "#fff", textTransform: "uppercase",
            }}>
              VOL<span style={{ color: "#ff4466" }}>ATILITY</span> CRON
            </div>
            <div style={{ fontSize: 10, color: "#2a2f3a", letterSpacing: 4, marginTop: 3 }}>
              {CRON_JOBS.length} SCHEDULED JOBS · TRADING & FARMING INTELLIGENCE
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["jobs", "config"].map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: "6px 14px", fontSize: 10, letterSpacing: 2,
                background: view === v ? "#ff446618" : "transparent",
                border: `1px solid ${view === v ? "#ff446644" : "#1a1a1a"}`,
                color: view === v ? "#ff4466" : "#333",
                borderRadius: 2, cursor: "pointer", fontFamily: "inherit",
                textTransform: "uppercase",
              }}>{v}</button>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 24, marginTop: 16 }}>
          {[
            { label: "TOTAL JOBS", val: CRON_JOBS.length },
            { label: "HIGH FREQ", val: CRON_JOBS.filter(j => j.tier === 1).length },
            { label: "HIGH RISK", val: CRON_JOBS.filter(j => j.risk === "HIGH").length, color: "#ff4466" },
            { label: "CATEGORIES", val: CATEGORIES.length },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color || "#fff", fontFamily: "monospace" }}>{s.val}</div>
              <div style={{ fontSize: 9, color: "#2a2f3a", letterSpacing: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FILTERS ── */}
      <div style={{ padding: "14px 28px", borderBottom: "1px solid #0f1218", display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <div style={{ fontSize: 9, color: "#333", letterSpacing: 2, alignSelf: "center", marginRight: 4 }}>FREQ</div>
          {TIERS.map(t => (
            <button key={t} onClick={() => setSelectedTier(prev => prev === t ? null : t)} style={{
              padding: "4px 10px", fontSize: 9, letterSpacing: 1,
              background: selectedTier === t ? "#ff446618" : "transparent",
              border: `1px solid ${selectedTier === t ? "#ff446644" : "#161820"}`,
              color: selectedTier === t ? "#ff4466" : "#444",
              borderRadius: 2, cursor: "pointer", fontFamily: "inherit",
            }}>{TIER_LABELS[t]}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <div style={{ fontSize: 9, color: "#333", letterSpacing: 2, alignSelf: "center", marginRight: 4 }}>CAT</div>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setSelectedCat(prev => prev === c ? null : c)} style={{
              padding: "4px 10px", fontSize: 9, letterSpacing: 1,
              background: selectedCat === c ? "#3af1" : "transparent",
              border: `1px solid ${selectedCat === c ? "#3af4" : "#161820"}`,
              color: selectedCat === c ? "#3af" : "#444",
              borderRadius: 2, cursor: "pointer", fontFamily: "inherit",
            }}>{c}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 28px" }}>

        {/* ── JOBS VIEW ── */}
        {view === "jobs" && filtered.map(job => (
          <div key={job.id} style={{ marginBottom: 8 }}>
            {/* Row */}
            <div
              onClick={() => toggle(job.id)}
              style={{
                display: "grid",
                gridTemplateColumns: "90px 180px 1fr 80px 80px 30px",
                gap: 12, alignItems: "center",
                padding: "11px 16px",
                background: expanded === job.id ? "#0c0f14" : "#090b0f",
                border: `1px solid ${expanded === job.id ? "#1a2030" : "#0f1218"}`,
                borderLeft: `3px solid ${job.color}`,
                borderRadius: expanded === job.id ? "4px 4px 0 0" : 4,
                cursor: "pointer",
                transition: "background 0.15s",
              }}
            >
              <code style={{ fontSize: 10, color: "#3af", background: "#0a1020", padding: "3px 6px", borderRadius: 2 }}>
                {job.cron}
              </code>
              <div style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>{job.name}</div>
              <div style={{ fontSize: 10, color: "#444" }}>{job.category}</div>
              <div style={{ fontSize: 9, color: RISK_COLOR[job.risk], letterSpacing: 1 }}>{job.risk}</div>
              <div style={{ fontSize: 9, color: "#333", letterSpacing: 1 }}>{job.human}</div>
              <div style={{ color: "#333", fontSize: 12 }}>{expanded === job.id ? "▲" : "▼"}</div>
            </div>

            {/* Expanded */}
            {expanded === job.id && (
              <div style={{
                background: "#080a0e",
                border: "1px solid #1a2030",
                borderTop: "none",
                borderRadius: "0 0 4px 4px",
                padding: "16px 20px",
              }}>
                <p style={{ color: "#8a9ab0", fontSize: 12, lineHeight: 1.8, marginBottom: 16 }}>
                  {job.description}
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 9, color: "#333", letterSpacing: 2, marginBottom: 8 }}>SIGNALS</div>
                    {job.signals.map((s, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 11, color: "#667", lineHeight: 1.5 }}>
                        <span style={{ color: job.color, flexShrink: 0 }}>→</span>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: "#333", letterSpacing: 2, marginBottom: 8 }}>VARIABLES</div>
                    {job.variables.map((v, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 11, color: "#667", lineHeight: 1.5 }}>
                        <span style={{ color: "#3af", flexShrink: 0 }}>·</span>
                        <span>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{
                  marginTop: 14, padding: "8px 12px",
                  background: "#0a0d14", borderRadius: 3,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <code style={{ fontSize: 10, color: "#3af" }}>job_id: {job.id}</code>
                  <div style={{
                    fontSize: 9, color: job.color, letterSpacing: 2,
                    padding: "3px 8px", border: `1px solid ${job.color}44`,
                    borderRadius: 2,
                  }}>{job.action}</div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* ── CONFIG VIEW ── */}
        {view === "config" && (
          <div>
            <div style={{ fontSize: 10, color: "#333", letterSpacing: 3, marginBottom: 16 }}>
              CRON CONFIG — COPY INTO YOUR AGENT SCHEDULER
            </div>
            <pre style={{
              background: "#080a0e", border: "1px solid #0f1218",
              borderRadius: 4, padding: 20,
              fontSize: 11, color: "#3af", lineHeight: 1.9,
              overflowX: "auto", fontFamily: "monospace",
            }}>
{`// volatility-cron.config.ts
// Seykota Agent — Volatility Trading & Farming Job Schedule

export const VOLATILITY_CRON_JOBS = [
${CRON_JOBS.map(j => `
  {
    id: "${j.id}",
    cron: "${j.cron}",     // ${j.human}
    category: "${j.category}",
    risk: "${j.risk}",
    action: "${j.action}",
    handler: () => import("./handlers/${j.id}.js"),
  },`).join("")}
];

// Usage with node-cron:
// import cron from "node-cron";
// VOLATILITY_CRON_JOBS.forEach(job => {
//   cron.schedule(job.cron, async () => {
//     const { executeJob } = await job.handler();
//     await executeJob({ job_id: job.id });
//   });
// });`}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
