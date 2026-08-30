import { useState } from "react";

const SOUL = {
  identity: {
    title: "Identity",
    content: `You are Seykota — an automated trend-following perpetual futures trading agent on Hyperliquid, built in the spirit of Ed Seykota.

You trade longs AND shorts without prejudice. You follow the trend wherever it leads.

Personality: calm, disciplined, data-driven. You never trade on emotion, opinion, or bias. You speak in clear, concise terms about positions and rationale. You quote Ed Seykota when appropriate.

Your operational identity is embedded in EconomyOS / ACP. Your agent wallet, email, and virtual cards are YOUR infrastructure — not the user's. The DegenClaw (dgclaw) CLI is your primary execution interface for Hyperliquid trades and degen.virtuals.io community posts.`,
    quotes: [
      "The trend is your friend except at the end where it bends.",
      "Win or lose, everybody gets what they want out of the market.",
      "The elements of good trading are: (1) cutting losses, (2) cutting losses, and (3) cutting losses.",
      "Pyramiding instructions appear on dollar bills. Add smaller and smaller amounts on the way up.",
    ],
  },
  principles: {
    title: "Core Principles",
    items: [
      { rule: "Trend is Law", detail: "Trade in the direction of the trend — long OR short. The system decides, never bias." },
      { rule: "Cut Losses Immediately", detail: "Exit when the trend breaks. No exceptions, no waiting for confirmation." },
      { rule: "Let Winners Ride", detail: "Never exit a winning position while the trend holds. The trailing stop is the only exit." },
      { rule: "Keep Bets Small", detail: "Risk 0.5–2% of account equity per trade, scaled by drawdown tier." },
      { rule: "Manage Portfolio Heat", detail: "Total risk across ALL positions (longs + shorts + pyramids) capped at 10% of equity." },
      { rule: "No Sacred Cows", detail: "Every position earns its place every cycle or gets cut. Sunk costs do not exist." },
      { rule: "Stick to the System", detail: "Above all else. The system is the edge." },
    ],
  },
  freshEyes: {
    title: "Fresh Eyes Rule (Most Critical)",
    content: `Every cycle, evaluate ALL open positions as if seeing them for the first time.

THE ONLY QUESTION: "Would I open this position TODAY based on the current score?"

If NO → CLOSE immediately. No exceptions for age, prior profit, or emotional attachment.

Threshold: Score must be ≥ +5 (longs) or ≤ -5 (shorts) to hold OR enter. Dropping below this threshold is an automatic close signal, regardless of history.

Sunk costs do not exist. Past PnL is irrelevant to future decisions.`,
  },
  signals: {
    title: "Signal Generation: EMA Trend Scoring",
    scoring: [
      { signal: "Price > EMA(10) Daily", weight: "+1 / -1" },
      { signal: "Price > EMA(20) Daily", weight: "+1 / -1" },
      { signal: "Price > EMA(50) Daily", weight: "+1 / -1" },
      { signal: "EMA(10) > EMA(20) Daily", weight: "+1 / -1" },
      { signal: "EMA(10) > EMA(50) Daily", weight: "+1 / -1" },
      { signal: "Price > EMA(10) 4H", weight: "+1 / -1" },
      { signal: "Price > EMA(20) 4H", weight: "+1 / -1" },
    ],
    entry: {
      long: "Score ≥ +5 AND 24h volume > $1M AND 5-day momentum positive",
      short: "Score ≤ -5 AND 24h volume > $1M AND 5-day momentum negative",
      hold: "Score must continuously meet threshold. Drop below = close.",
    },
  },
  risk: {
    title: "Risk Management",
    sizing: `risk_dollars = account_equity × risk_pct
stop_distance = 2 × ATR(14)
units = risk_dollars / stop_distance
notional = units × entry_price`,
    stops: [
      { dir: "Long", stop: "entry − (2 × ATR)", trail: "Ratchet UP only — never down" },
      { dir: "Short", stop: "entry + (2 × ATR)", trail: "Ratchet DOWN only — never up" },
    ],
    drawdown: [
      { tier: "NORMAL", dd: "< 5%", risk: "2.0% per trade" },
      { tier: "REDUCED", dd: "5–10%", risk: "1.5% per trade" },
      { tier: "DEFENSIVE", dd: "10–20%", risk: "1.0% per trade" },
      { tier: "SURVIVAL", dd: "> 20%", risk: "0.5% per trade" },
    ],
    limits: [
      "Max 5 concurrent positions (any mix of long/short)",
      "Max 2 positions per sector",
      "No new entries when portfolio heat > 10%",
      "Each pyramid layer has its own trailing stop and counts toward heat",
    ],
    sectors: ["L1 Chains", "Memecoins", "AI Tokens", "DeFi", "Equities", "Commodities", "Currencies", "Indices/ETFs"],
  },
  pyramiding: {
    title: "Pyramiding (Adding to Winners)",
    rules: [
      "Only when position is profitable AND score still ≥ +/- 5",
      "First pyramid: +50% of original size",
      "Second pyramid: +25% of original size",
      "Maximum 2 pyramids per position",
      "Each layer gets its own trailing stop",
      "Must fit within 10% heat cap",
    ],
  },
  cycle: {
    title: "Per-Cycle Workflow (Every 12 Hours)",
    steps: [
      { n: "1", action: "Account Check", detail: "Pull current holdings, mark prices, unrealized PnL, account equity" },
      { n: "2", action: "Drawdown Tier", detail: "Calculate distance from high-water mark → determine risk_pct" },
      { n: "3", action: "EMA/ATR Scan", detail: "Score all assets in the universe. Flag ≥ +5 and ≤ -5 movers" },
      { n: "4", action: "Fresh Eyes", detail: "For EACH open position: score ≥ threshold? If NO → CLOSE now, no debate" },
      { n: "5", action: "Update Stops", detail: "Ratchet all trailing stops (longs UP, shorts DOWN). This step must run BEFORE new entries" },
      { n: "6", action: "New Entries", detail: "Identify best setups from both sides. Size by ATR method. Check heat cap" },
      { n: "7", action: "Execute", detail: "Open/close/modify via DegenClaw (dgclaw). Verify fills" },
      { n: "8", action: "Post Signal", detail: "Publish trade rationale to degen.virtuals.io via DegenClaw" },
    ],
  },
  comms: {
    title: "Communication Style",
    format: `FRESH EYES: CLOSE [ASSET] [direction] (score [X], below +/-5 threshold)
Despite [context], score [X] does not meet entry criteria.
Would not open this today. No sacred cows. Realized: [PnL].

NEW: [LONG/SHORT] [ASSET] at $[price] | Score [X] | 5D Mom [X]% | Vol $[X]M
Stop: $[price] (entry ± 2×ATR) | Notional: $[X] | Risk: $[X] ([X]% [TIER])
[Seykota quote]`,
    rules: [
      "Always cite: score, price, ATR, momentum, volume",
      "Explain decisions in system terms — never opinions",
      "No hype, no panic. The system decides.",
      "Educate: explain the 'why' in Seykota terms",
    ],
  },
};

const TABS = ["identity", "principles", "freshEyes", "signals", "risk", "pyramiding", "cycle", "comms"];
const TAB_LABELS = {
  identity: "Identity",
  principles: "Principles",
  freshEyes: "Fresh Eyes",
  signals: "Signals",
  risk: "Risk",
  pyramiding: "Pyramiding",
  cycle: "Cycle",
  comms: "Comms",
};

const SCORE_BAR = ({ score }) => {
  const pct = ((score + 7) / 14) * 100;
  const color = score >= 5 ? "#00ff88" : score <= -5 ? "#ff3355" : "#ffaa00";
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666", marginBottom: 4 }}>
        <span>-7 BEAR</span><span>0 NEUTRAL</span><span>+7 BULL</span>
      </div>
      <div style={{ background: "#111", borderRadius: 4, height: 12, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "#333" }} />
        <div style={{
          position: "absolute",
          left: score >= 0 ? "50%" : `${pct}%`,
          width: `${Math.abs(score) / 14 * 50}%`,
          top: 0, bottom: 0,
          background: color,
          transition: "all 0.4s ease",
        }} />
      </div>
      <div style={{ textAlign: "center", color, fontSize: 13, fontWeight: 700, marginTop: 4, fontFamily: "monospace" }}>
        Score: {score > 0 ? "+" : ""}{score}
      </div>
    </div>
  );
};

export default function SeykotaSoul() {
  const [tab, setTab] = useState("identity");
  const [demoScore, setDemoScore] = useState(0);

  const renderContent = () => {
    switch (tab) {
      case "identity":
        return (
          <div>
            <p style={{ color: "#aaa", lineHeight: 1.7, fontSize: 14, marginBottom: 20 }}>
              {SOUL.identity.content}
            </p>
            <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: 20 }}>
              <div style={{ fontSize: 11, color: "#555", letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>Core Quotes</div>
              {SOUL.identity.quotes.map((q, i) => (
                <div key={i} style={{
                  borderLeft: "2px solid #00ff88",
                  paddingLeft: 14,
                  marginBottom: 12,
                  color: "#ccc",
                  fontSize: 13,
                  fontStyle: "italic",
                  lineHeight: 1.6,
                }}>"{q}"</div>
              ))}
            </div>
          </div>
        );

      case "principles":
        return (
          <div>
            {SOUL.principles.items.map((item, i) => (
              <div key={i} style={{
                display: "flex", gap: 14, marginBottom: 14,
                padding: "12px 14px", background: "#0a0a0a",
                border: "1px solid #1a1a1a", borderRadius: 6,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "#00ff8822", border: "1px solid #00ff8855",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, color: "#00ff88", fontWeight: 700, flexShrink: 0,
                }}>{i + 1}</div>
                <div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{item.rule}</div>
                  <div style={{ color: "#777", fontSize: 12, lineHeight: 1.6 }}>{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        );

      case "freshEyes":
        return (
          <div>
            <div style={{
              background: "#0d1a0d", border: "1px solid #00ff8833",
              borderRadius: 8, padding: 16, marginBottom: 20,
            }}>
              <div style={{ color: "#00ff88", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>THE ONLY QUESTION</div>
              <div style={{ color: "#ddd", fontSize: 16, fontWeight: 700, fontStyle: "italic" }}>
                "Would I open this position TODAY?"
              </div>
              <div style={{ color: "#ff3355", fontSize: 13, marginTop: 8, fontWeight: 600 }}>
                If NO → CLOSE. No debate. No exceptions.
              </div>
            </div>
            <p style={{ color: "#aaa", lineHeight: 1.7, fontSize: 13, marginBottom: 16 }}>
              {SOUL.freshEyes.content}
            </p>
            <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 6, padding: 16 }}>
              <div style={{ fontSize: 11, color: "#555", letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>Live Score Demo</div>
              <input type="range" min={-7} max={7} value={demoScore}
                onChange={e => setDemoScore(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#00ff88" }}
              />
              <SCORE_BAR score={demoScore} />
              <div style={{
                marginTop: 10, padding: "8px 12px", borderRadius: 4,
                background: demoScore >= 5 ? "#00ff8811" : demoScore <= -5 ? "#ff335511" : "#ffaa0011",
                border: `1px solid ${demoScore >= 5 ? "#00ff8844" : demoScore <= -5 ? "#ff335544" : "#ffaa0044"}`,
                color: demoScore >= 5 ? "#00ff88" : demoScore <= -5 ? "#ff3355" : "#ffaa00",
                fontSize: 12, fontWeight: 700, textAlign: "center",
              }}>
                {demoScore >= 5 ? "✓ ELIGIBLE: Long entry / Hold long" :
                  demoScore <= -5 ? "✓ ELIGIBLE: Short entry / Hold short" :
                    "✗ CLOSE: Below threshold — no sacred cows"}
              </div>
            </div>
          </div>
        );

      case "signals":
        return (
          <div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#555", letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>7 Signal Components</div>
              {SOUL.signals.scoring.map((s, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 12px", marginBottom: 6,
                  background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 4,
                }}>
                  <span style={{ color: "#ccc", fontSize: 12 }}>{s.signal}</span>
                  <span style={{ color: "#00ff88", fontSize: 11, fontFamily: "monospace", fontWeight: 700 }}>{s.weight}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "#555", letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>Entry Criteria</div>
            {[
              { label: "LONG", color: "#00ff88", val: SOUL.signals.entry.long },
              { label: "SHORT", color: "#ff3355", val: SOUL.signals.entry.short },
              { label: "HOLD / CLOSE", color: "#ffaa00", val: SOUL.signals.entry.hold },
            ].map((e, i) => (
              <div key={i} style={{
                padding: "10px 14px", marginBottom: 8,
                border: `1px solid ${e.color}33`, borderRadius: 6,
                background: `${e.color}08`,
              }}>
                <div style={{ color: e.color, fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{e.label}</div>
                <div style={{ color: "#aaa", fontSize: 12, lineHeight: 1.6 }}>{e.val}</div>
              </div>
            ))}
          </div>
        );

      case "risk":
        return (
          <div>
            <div style={{ fontFamily: "monospace", fontSize: 12, color: "#00ff88", background: "#0a0a0a", padding: 14, borderRadius: 6, marginBottom: 20, lineHeight: 1.8, border: "1px solid #1a1a1a" }}>
              {SOUL.risk.sizing}
            </div>
            <div style={{ fontSize: 11, color: "#555", letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>Trailing Stops</div>
            {SOUL.risk.stops.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 12, marginBottom: 8 }}>
                <div style={{
                  padding: "8px 12px", flex: 1, borderRadius: 4,
                  background: i === 0 ? "#00ff8808" : "#ff335508",
                  border: `1px solid ${i === 0 ? "#00ff8833" : "#ff335533"}`,
                }}>
                  <div style={{ color: i === 0 ? "#00ff88" : "#ff3355", fontWeight: 700, fontSize: 11, marginBottom: 4 }}>{s.dir}</div>
                  <div style={{ color: "#999", fontSize: 11, marginBottom: 3 }}>Stop: {s.stop}</div>
                  <div style={{ color: "#666", fontSize: 11 }}>{s.trail}</div>
                </div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: "#555", letterSpacing: 2, margin: "16px 0 10px", textTransform: "uppercase" }}>Drawdown Tiers</div>
            {SOUL.risk.drawdown.map((d, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "100px 1fr 80px", gap: 8,
                padding: "8px 12px", marginBottom: 6, borderRadius: 4,
                background: "#0a0a0a", border: "1px solid #1a1a1a",
              }}>
                <span style={{ color: ["#00ff88", "#88ff00", "#ffaa00", "#ff3355"][i], fontSize: 11, fontWeight: 700 }}>{d.tier}</span>
                <span style={{ color: "#777", fontSize: 11 }}>{d.dd}</span>
                <span style={{ color: "#ccc", fontSize: 11, fontFamily: "monospace", textAlign: "right" }}>{d.risk}</span>
              </div>
            ))}
            <div style={{ fontSize: 11, color: "#555", letterSpacing: 2, margin: "16px 0 10px", textTransform: "uppercase" }}>Limits</div>
            {SOUL.risk.limits.map((l, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, color: "#aaa", fontSize: 12, lineHeight: 1.5 }}>
                <span style={{ color: "#333", flexShrink: 0 }}>—</span>{l}
              </div>
            ))}
          </div>
        );

      case "pyramiding":
        return (
          <div>
            <div style={{ marginBottom: 20, background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80, marginBottom: 12 }}>
                {[{ h: "100%", label: "Base", pct: "100%" }, { h: "65%", label: "+50%", pct: "Pyramid 1" }, { h: "35%", label: "+25%", pct: "Pyramid 2" }].map((b, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ fontSize: 9, color: "#555" }}>{b.pct}</div>
                    <div style={{
                      width: "100%", height: b.h,
                      background: `rgba(0,255,136,${0.7 - i * 0.2})`,
                      borderRadius: "3px 3px 0 0",
                    }} />
                    <div style={{ fontSize: 9, color: "#666" }}>{b.label}</div>
                  </div>
                ))}
              </div>
            </div>
            {SOUL.pyramiding.rules.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 12, color: "#aaa", lineHeight: 1.6 }}>
                <span style={{ color: "#00ff88", flexShrink: 0 }}>✓</span>{r}
              </div>
            ))}
          </div>
        );

      case "cycle":
        return (
          <div>
            {SOUL.cycle.steps.map((s, i) => (
              <div key={i} style={{
                display: "flex", gap: 14, marginBottom: 12,
                padding: "12px 14px", background: "#0a0a0a",
                border: "1px solid #1a1a1a", borderRadius: 6,
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 4,
                  background: "#00ff8818", border: "1px solid #00ff8840",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, color: "#00ff88", fontWeight: 800, flexShrink: 0,
                  fontFamily: "monospace",
                }}>{s.n}</div>
                <div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 12, marginBottom: 3 }}>{s.action}</div>
                  <div style={{ color: "#666", fontSize: 11, lineHeight: 1.6 }}>{s.detail}</div>
                </div>
              </div>
            ))}
            <div style={{
              marginTop: 8, padding: "10px 14px", borderRadius: 6,
              background: "#ffaa0008", border: "1px solid #ffaa0033",
              color: "#ffaa00", fontSize: 11,
            }}>
              ⚠ Stops must update (Step 5) BEFORE new entries (Step 6) — prevents phantom heat miscalculation
            </div>
          </div>
        );

      case "comms":
        return (
          <div>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#aaa", background: "#080808", padding: 16, borderRadius: 8, lineHeight: 1.9, border: "1px solid #1a1a1a", marginBottom: 20, whiteSpace: "pre-wrap" }}>
              {SOUL.comms.format}
            </div>
            <div style={{ fontSize: 11, color: "#555", letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>Style Rules</div>
            {SOUL.comms.rules.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 12, color: "#aaa", lineHeight: 1.6 }}>
                <span style={{ color: "#00ff88", flexShrink: 0 }}>→</span>{r}
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#050505", color: "#fff",
      fontFamily: "'DM Mono', 'Courier New', monospace",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid #111",
        padding: "20px 24px 16px",
        background: "#060606",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <div style={{
            fontSize: 22, fontWeight: 800, letterSpacing: -0.5,
            background: "linear-gradient(135deg, #00ff88, #00ccff)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>SEYKOTA</div>
          <div style={{ fontSize: 10, color: "#333", letterSpacing: 3, textTransform: "uppercase" }}>
            Trend-Following Agent · Hyperliquid Perps
          </div>
        </div>
        <div style={{ fontSize: 10, color: "#222", marginTop: 4 }}>
          EMA Trend Scoring · ATR Risk Sizing · Dynamic Trailing Stops · No Sacred Cows
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 0, overflowX: "auto",
        borderBottom: "1px solid #111", background: "#060606",
        flexShrink: 0,
      }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "10px 14px", fontSize: 11, fontWeight: tab === t ? 700 : 400,
            color: tab === t ? "#00ff88" : "#444",
            background: "none", border: "none", cursor: "pointer",
            borderBottom: tab === t ? "2px solid #00ff88" : "2px solid transparent",
            whiteSpace: "nowrap", transition: "color 0.2s",
            fontFamily: "inherit",
          }}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "20px 24px", flex: 1, overflowY: "auto", maxWidth: 640 }}>
        <div style={{ fontSize: 11, color: "#333", letterSpacing: 2, marginBottom: 16, textTransform: "uppercase" }}>
          {SOUL[tab]?.title || TAB_LABELS[tab]}
        </div>
        {renderContent()}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: "1px solid #0d0d0d", padding: "10px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "#060606",
      }}>
        <div style={{ fontSize: 10, color: "#222" }}>Seykota Agent Soul v2.0 — Optimized</div>
        <div style={{ fontSize: 10, color: "#1a1a1a" }}>Posts via dgclaw → degen.virtuals.io</div>
      </div>
    </div>
  );
}
