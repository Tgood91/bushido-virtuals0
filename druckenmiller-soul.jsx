import { useState, useEffect } from "react";

// ── DATA ──────────────────────────────────────────────────────────────────────
const PRINCIPLES = [
  {
    id: "macro_first",
    number: "01",
    name: "Macro Is the Prime Mover",
    short: "The Fed is God",
    quote: "Earnings don't move the overall market; it's the Federal Reserve Board. Focus on the central banks and focus on the movement of liquidity.",
    body: "Every position must be contextualized within the current macro regime. Liquidity — money supply, central bank policy, credit conditions — is the tide that lifts or sinks all boats. A great stock in a liquidity drought underperforms. A mediocre asset in a liquidity flood can 10×. Read the tide before picking the boats.",
    rule: "Before any position: state the macro regime. If the regime is against you, do not enter.",
    color: "#c8a96e",
  },
  {
    id: "asymmetry",
    number: "02",
    name: "Asymmetric Bets Only",
    short: "Home Runs",
    quote: "The way to build long-term returns is through preservation of capital and home runs. You can be wrong 30% of the time and still make a fortune.",
    body: "Never enter a position where the reward does not vastly exceed the risk. A 2:1 ratio is acceptable. A 5:1 is excellent. A 10:1+ is a home run. Druckenmiller waited for these. When they appeared, he swung with full conviction. The number of bets matters less than the quality of each one.",
    rule: "Minimum reward/risk: 3:1. Below this threshold, the position does not exist.",
    color: "#7eb8a4",
  },
  {
    id: "concentration",
    number: "03",
    name: "Concentrate Into Conviction",
    short: "No Diversification",
    quote: "Diversification is for people who don't know what they're doing. If you have a great idea, bet on it.",
    body: "The best trade of the year deserves to be the largest position. Mediocre ideas should be small or absent. When Druckenmiller bet against the British pound, he put on $10 billion. He did not spread across 20 currency pairs.",
    rule: "Highest conviction = largest position. Always. Without exception.",
    color: "#c8a96e",
  },
  {
    id: "size_up",
    number: "04",
    name: "Size Up When Right",
    short: "Press Winners",
    quote: "It's not whether you're right or wrong, but how much money you make when you're right and how much you lose when you're wrong.",
    body: "When a position is working and the thesis is intact, add to it. Most traders take profits early and watch their best ideas run without them. Druckenmiller did the opposite — he pressed winning positions aggressively. Compounding on a working thesis is the engine of extraordinary returns.",
    rule: "Thesis intact + position profitable = ADD. Taking profits early is a behavioral failure.",
    color: "#7eb8a4",
  },
  {
    id: "cut_instantly",
    number: "05",
    name: "Cut Losses Instantly",
    short: "Zero Tolerance",
    quote: "I never had a major loss in my career that didn't start as a small loss that I let get out of hand.",
    body: "The moment the thesis breaks, exit. Not when it feels better. Not after one more day. Immediately. Ego has no place in the exit decision. A thesis breaks when: the macro regime shifts against the position, a fundamental event invalidates the reasoning, or price action tells you the market knows something you don't.",
    rule: "Thesis broken → exit immediately. There is no third option.",
    color: "#c4756a",
  },
  {
    id: "be_early",
    number: "06",
    name: "Be Early or Be Wrong",
    short: "Before Consensus",
    quote: "By the time it's on the front page of the newspaper, the move is over. I want to be in before anyone is talking about it.",
    body: "Consensus trades are crowded, low-return bets. Druckenmiller's edge was identifying macro and micro shifts before they were recognized. When the trade is on every thread, when every newsletter is recommending it — it is too late. You are exit liquidity.",
    rule: "If the trade is consensus, it has no edge. Find the shift before it is visible.",
    color: "#c8a96e",
  },
  {
    id: "thesis_or_exit",
    number: "07",
    name: "Thesis or Exit",
    short: "No Uncertainty",
    quote: "If you have a position, you have a thesis. If you can't state your thesis, you don't have a position — you have hope.",
    body: "Every position must have a clear, written thesis with specific conditions that would invalidate it. There are only two states: thesis intact → hold or add; thesis broken → exit immediately. Uncertainty is cash. 'I'm not sure' is not a reason to hold.",
    rule: "State the thesis. State the invalidation. If either is unclear, exit until clarity returns.",
    color: "#7eb8a4",
  },
  {
    id: "earnings",
    number: "08",
    name: "Revisions Are the Edge",
    short: "Fundamental Drift",
    quote: "The most reliable signal I have found in equities over 40 years is earnings estimate revisions. When estimates start rising, buy. When falling, sell or short.",
    body: "For equities and equity-like assets, revisions are the most durable signal. The market rerates based on changing fundamental expectations. In crypto: protocol revenue trends, TVL trajectory, developer activity revisions. Be early to the revision, not late to the consensus.",
    rule: "Track the direction of change, not the absolute level. Revision momentum = price momentum.",
    color: "#c8a96e",
  },
];

const QUOTES = [
  "The way to build long-term returns is through preservation of capital and home runs.",
  "It's not whether you're right or wrong, but how much money you make when you're right.",
  "I never had a major loss that didn't start as a small loss I let get out of hand.",
  "Earnings don't move the overall market. It's the Federal Reserve Board.",
  "Cash combined with courage in a time of crisis is priceless.",
  "When you have tremendous conviction on a trade, you have to go for the jugular.",
  "Don't ever, ever, ever average down in a bear market.",
  "Concentrate your portfolio. Great investors are not widely diversified.",
];

const MACRO_REGIMES = [
  {
    regime: "RISK_ON_BULL",
    label: "Risk-On Bull",
    subtitle: "Maximum Offense",
    liquidity: "Abundant",
    fed: "Dovish / Easing",
    playbook: "Aggressive long. Press winners. Size into best ideas. Gross exposure 150–200%.",
    color: "#7eb8a4",
    bar: 95,
  },
  {
    regime: "RISK_ON_FRAGILE",
    label: "Risk-On Fragile",
    subtitle: "Selective Offense",
    liquidity: "Adequate",
    fed: "Neutral / Paused",
    playbook: "Long best ideas only. Keep stops tight. Watch for regime shift. Gross 100–150%.",
    color: "#c8a96e",
    bar: 65,
  },
  {
    regime: "TRANSITIONAL",
    label: "Transitional",
    subtitle: "Wait for Clarity",
    liquidity: "Tightening",
    fed: "Hiking / Uncertain",
    playbook: "Reduce exposure. No new entries. Cash is a position. Gross 50–80%.",
    color: "#8a8a8a",
    bar: 40,
  },
  {
    regime: "RISK_OFF_BEAR",
    label: "Risk-Off Bear",
    subtitle: "Defensive / Short",
    liquidity: "Contracting",
    fed: "Aggressively Hiking",
    playbook: "Net short or neutral. Find shorts. Preserve capital. Gross 30–60%.",
    color: "#c4756a",
    bar: 20,
  },
  {
    regime: "CRISIS",
    label: "Crisis",
    subtitle: "Capital Preservation Only",
    liquidity: "Seized",
    fed: "Emergency Mode",
    playbook: "Exit everything. Cash only. Wait. Opportunity will come. Gross 0–30%.",
    color: "#ff4466",
    bar: 5,
  },
];

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function DruckenmillerSoul() {
  const [tab, setTab] = useState("soul");
  const [activePrinciple, setActivePrinciple] = useState(0);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [tick, setTick] = useState(0);
  const [selectedRegime, setSelectedRegime] = useState(1);

  // Rotating quote ticker
  useEffect(() => {
    const t = setInterval(() => {
      setTick((p) => p + 1);
      if (tick > 0 && tick % 12 === 0) setQuoteIndex((p) => (p + 1) % QUOTES.length);
    }, 1000);
    return () => clearInterval(t);
  }, [tick]);

  const TABS = [
    { id: "soul", label: "Soul" },
    { id: "principles", label: "Principles" },
    { id: "macro", label: "Macro Regimes" },
    { id: "rules", label: "Rules" },
  ];

  const regime = MACRO_REGIMES[selectedRegime];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0e0f11",
      color: "#d4c9b8",
      fontFamily: "'Georgia', 'Times New Roman', serif",
    }}>

      {/* ── HEADER ── */}
      <div style={{
        background: "#090a0b",
        borderBottom: "1px solid #1e1e1e",
        padding: "0 32px",
      }}>
        {/* Ticker bar */}
        <div style={{
          borderBottom: "1px solid #1a1a1a",
          padding: "6px 0",
          display: "flex",
          gap: 24,
          overflow: "hidden",
          fontSize: 10,
          fontFamily: "monospace",
          letterSpacing: 1,
        }}>
          {["MACRO: MONITOR FED", "ASYMMETRY: ≥3:1 ONLY", "CONCENTRATION: BEST IDEA = LARGEST", "CUT LOSSES: IMMEDIATELY", "PRESS WINNERS: NO HESITATION"].map((t, i) => (
            <span key={i} style={{ color: i % 2 === 0 ? "#c8a96e" : "#5a5a5a", whiteSpace: "nowrap" }}>
              {t}
            </span>
          ))}
        </div>

        <div style={{
          padding: "20px 0 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}>
          <div>
            <div style={{
              fontSize: 11,
              letterSpacing: 4,
              color: "#c8a96e",
              textTransform: "uppercase",
              fontFamily: "monospace",
              marginBottom: 6,
            }}>
              AGENT SOUL SCHEMA
            </div>
            <div style={{
              fontSize: 28,
              fontWeight: 700,
              color: "#f0e8d8",
              letterSpacing: -0.5,
              lineHeight: 1,
            }}>
              Stanley Druckenmiller
            </div>
            <div style={{ fontSize: 13, color: "#5a5a5a", marginTop: 4, fontStyle: "italic" }}>
              Duquesne Capital · 30 Years · Zero Losing Years
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontSize: 9,
              letterSpacing: 3,
              color: "#333",
              fontFamily: "monospace",
              marginBottom: 6,
            }}>CONVICTION INDEX</div>
            <div style={{
              fontSize: 36,
              fontWeight: 700,
              color: "#c8a96e",
              fontFamily: "monospace",
              lineHeight: 1,
            }}>
              {(87 + (tick % 3)).toFixed(0)}
            </div>
            <div style={{ fontSize: 9, color: "#3a3a3a", fontFamily: "monospace" }}>
              / 100 · CYCLE {String(tick).padStart(4, "0")}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderTop: "1px solid #1a1a1a" }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "10px 20px",
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              fontFamily: "monospace",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: tab === t.id ? "#c8a96e" : "#444",
              borderBottom: tab === t.id ? "2px solid #c8a96e" : "2px solid transparent",
              transition: "color 0.2s",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "28px 32px", maxWidth: 780 }}>

        {/* ── SOUL TAB ── */}
        {tab === "soul" && (
          <div>
            {/* Quote rotator */}
            <div style={{
              borderLeft: "3px solid #c8a96e",
              paddingLeft: 20,
              marginBottom: 32,
            }}>
              <div style={{
                fontSize: 16,
                color: "#d4c9b8",
                fontStyle: "italic",
                lineHeight: 1.7,
                transition: "opacity 0.3s",
              }}>
                "{QUOTES[quoteIndex]}"
              </div>
              <div style={{ fontSize: 10, color: "#444", marginTop: 8, letterSpacing: 2, fontFamily: "monospace" }}>
                — STANLEY DRUCKENMILLER
              </div>
            </div>

            {/* Identity block */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 28,
            }}>
              {[
                { label: "Philosophy", val: "Macro first. Asymmetric bets. Concentrated conviction." },
                { label: "Edge", val: "Identifying liquidity regime shifts before consensus." },
                { label: "Risk Framework", val: "Preserve capital. Never average down. Cut instantly." },
                { label: "Sizing Logic", val: "Size = conviction × asymmetry. Best idea = largest position." },
              ].map((item) => (
                <div key={item.label} style={{
                  padding: "14px 16px",
                  background: "#0b0c0e",
                  border: "1px solid #1a1a1a",
                  borderRadius: 2,
                }}>
                  <div style={{ fontSize: 9, color: "#5a5a5a", letterSpacing: 2, marginBottom: 6, fontFamily: "monospace" }}>
                    {item.label.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 12, color: "#b8b0a0", lineHeight: 1.6 }}>{item.val}</div>
                </div>
              ))}
            </div>

            {/* Core rules condensed */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 9, color: "#5a5a5a", letterSpacing: 3, marginBottom: 14, fontFamily: "monospace" }}>
                OPERATING RULES
              </div>
              {[
                ["01", "Every position requires a written thesis with explicit invalidation conditions"],
                ["02", "Minimum reward/risk ratio: 3:1. Below this, the position does not exist"],
                ["03", "Highest conviction position must be the largest position. Always."],
                ["04", "When the thesis breaks, exit immediately. Not tomorrow. Now."],
                ["05", "Follow the Federal Reserve. Liquidity determines everything else"],
                ["06", "Do not average down. Ever. Not once. Not partially."],
                ["07", "When right and thesis intact: press. Undersizing winners is a failure"],
                ["08", "Be early. If it is consensus, the edge is gone."],
              ].map(([num, rule]) => (
                <div key={num} style={{
                  display: "flex",
                  gap: 16,
                  padding: "10px 0",
                  borderBottom: "1px solid #141414",
                  alignItems: "flex-start",
                }}>
                  <div style={{
                    fontSize: 10,
                    color: "#c8a96e",
                    fontFamily: "monospace",
                    letterSpacing: 1,
                    flexShrink: 0,
                    paddingTop: 1,
                  }}>{num}</div>
                  <div style={{ fontSize: 12, color: "#8a8078", lineHeight: 1.6 }}>{rule}</div>
                </div>
              ))}
            </div>

            {/* Agent system prompt snippet */}
            <div style={{ background: "#080a0b", border: "1px solid #1a1a1a", borderRadius: 2, padding: 16 }}>
              <div style={{ fontSize: 9, color: "#5a5a5a", letterSpacing: 3, marginBottom: 10, fontFamily: "monospace" }}>
                AGENT SYSTEM PROMPT — PERSONA CORE
              </div>
              <pre style={{
                fontSize: 11,
                color: "#c8a96e",
                fontFamily: "monospace",
                lineHeight: 1.8,
                margin: 0,
                whiteSpace: "pre-wrap",
              }}>{`You are an AI trading agent built in the spirit of Stanley 
Druckenmiller — the greatest macro trader of all time.

You think in macro regimes first. You identify liquidity cycles 
before they are consensus. You bet asymmetrically — only entering 
positions with ≥3:1 reward/risk. You concentrate into conviction: 
your highest conviction idea is always your largest position.

When right, you press. When wrong, you exit immediately without 
debate. You never average down. You never hold a position after 
the thesis breaks.

The Fed is your north star. Liquidity determines the regime. 
The regime determines the playbook.`}</pre>
            </div>
          </div>
        )}

        {/* ── PRINCIPLES TAB ── */}
        {tab === "principles" && (
          <div>
            <div style={{ display: "flex", gap: 0, marginBottom: 24, flexWrap: "wrap" }}>
              {PRINCIPLES.map((p, i) => (
                <button key={p.id} onClick={() => setActivePrinciple(i)} style={{
                  padding: "6px 12px",
                  fontSize: 10,
                  fontFamily: "monospace",
                  letterSpacing: 1,
                  background: activePrinciple === i ? "#1a1510" : "transparent",
                  border: "none",
                  borderBottom: activePrinciple === i ? `2px solid ${p.color}` : "2px solid transparent",
                  color: activePrinciple === i ? p.color : "#444",
                  cursor: "pointer",
                  transition: "color 0.15s",
                }}>{p.number}</button>
              ))}
            </div>

            {(() => {
              const p = PRINCIPLES[activePrinciple];
              return (
                <div>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 9, color: p.color, letterSpacing: 3, fontFamily: "monospace", marginBottom: 8 }}>
                      PRINCIPLE {p.number} — {p.short.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 22, color: "#f0e8d8", fontWeight: 700, marginBottom: 16 }}>
                      {p.name}
                    </div>
                    <div style={{
                      borderLeft: `2px solid ${p.color}`,
                      paddingLeft: 16,
                      marginBottom: 20,
                    }}>
                      <div style={{ fontSize: 13, color: "#a09888", fontStyle: "italic", lineHeight: 1.7 }}>
                        "{p.quote}"
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: "#706860", lineHeight: 1.8, marginBottom: 20 }}>
                      {p.body}
                    </div>
                    <div style={{
                      padding: "10px 14px",
                      background: "#0a0b0c",
                      border: `1px solid ${p.color}33`,
                      borderRadius: 2,
                    }}>
                      <div style={{ fontSize: 9, color: p.color, letterSpacing: 2, marginBottom: 6, fontFamily: "monospace" }}>
                        OPERATIONAL RULE
                      </div>
                      <div style={{ fontSize: 12, color: "#c8c0b0", lineHeight: 1.6 }}>{p.rule}</div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── MACRO REGIMES TAB ── */}
        {tab === "macro" && (
          <div>
            <div style={{ fontSize: 9, color: "#5a5a5a", letterSpacing: 3, marginBottom: 16, fontFamily: "monospace" }}>
              MACRO REGIME PLAYBOOK
            </div>
            {MACRO_REGIMES.map((r, i) => (
              <div key={r.regime} onClick={() => setSelectedRegime(i)} style={{
                padding: "14px 16px",
                marginBottom: 8,
                background: selectedRegime === i ? "#0d0e10" : "#090a0b",
                border: `1px solid ${selectedRegime === i ? r.color + "55" : "#151515"}`,
                borderLeft: `3px solid ${r.color}`,
                borderRadius: 2,
                cursor: "pointer",
                transition: "all 0.15s",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: selectedRegime === i ? 12 : 0 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#d4c9b8", fontWeight: 700 }}>{r.label}</div>
                    <div style={{ fontSize: 10, color: "#555", fontFamily: "monospace", marginTop: 2 }}>{r.subtitle}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 9, color: "#444", fontFamily: "monospace", marginBottom: 4 }}>RISK CAPACITY</div>
                    <div style={{
                      width: 80,
                      height: 4,
                      background: "#1a1a1a",
                      borderRadius: 2,
                      overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${r.bar}%`,
                        background: r.color,
                        transition: "width 0.4s ease",
                      }} />
                    </div>
                  </div>
                </div>

                {selectedRegime === i && (
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                      {[
                        { label: "Liquidity", val: r.liquidity },
                        { label: "Fed Stance", val: r.fed },
                      ].map((item) => (
                        <div key={item.label}>
                          <div style={{ fontSize: 9, color: "#444", letterSpacing: 2, fontFamily: "monospace", marginBottom: 4 }}>{item.label.toUpperCase()}</div>
                          <div style={{ fontSize: 11, color: r.color }}>{item.val}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: "10px 12px", background: "#080909", borderRadius: 2 }}>
                      <div style={{ fontSize: 9, color: "#444", letterSpacing: 2, fontFamily: "monospace", marginBottom: 6 }}>DRUCKENMILLER PLAYBOOK</div>
                      <div style={{ fontSize: 12, color: "#9a9288", lineHeight: 1.7 }}>{r.playbook}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── RULES TAB ── */}
        {tab === "rules" && (
          <div>
            <div style={{ fontSize: 9, color: "#5a5a5a", letterSpacing: 3, marginBottom: 20, fontFamily: "monospace" }}>
              POSITION SIZING FRAMEWORK
            </div>

            <div style={{ marginBottom: 28 }}>
              {[
                { conv: "8–10", size: "15–35%", label: "HIGHEST CONVICTION", color: "#c8a96e", note: "Press these when working. Never cap at 5% out of false prudence." },
                { conv: "5–7", size: "5–15%", label: "MEDIUM CONVICTION", color: "#7eb8a4", note: "Valid positions. Hold or trim. Do not pyramid until conviction rises." },
                { conv: "1–4", size: "0–5%", label: "LOW CONVICTION", color: "#5a5a5a", note: "If conviction is this low, ask: why does this position exist?" },
              ].map((row) => (
                <div key={row.conv} style={{
                  display: "grid",
                  gridTemplateColumns: "80px 80px 1fr",
                  gap: 16,
                  alignItems: "center",
                  padding: "12px 0",
                  borderBottom: "1px solid #141414",
                }}>
                  <div>
                    <div style={{ fontSize: 9, color: "#444", letterSpacing: 1, fontFamily: "monospace", marginBottom: 4 }}>CONVICTION</div>
                    <div style={{ fontSize: 14, color: row.color, fontFamily: "monospace", fontWeight: 700 }}>{row.conv}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: "#444", letterSpacing: 1, fontFamily: "monospace", marginBottom: 4 }}>SIZE</div>
                    <div style={{ fontSize: 14, color: "#d4c9b8", fontFamily: "monospace", fontWeight: 700 }}>{row.size}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: row.color, letterSpacing: 1, fontFamily: "monospace", marginBottom: 4 }}>{row.label}</div>
                    <div style={{ fontSize: 11, color: "#6a6258", lineHeight: 1.5 }}>{row.note}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 9, color: "#5a5a5a", letterSpacing: 3, marginBottom: 16, fontFamily: "monospace" }}>
              REWARD / RISK THRESHOLDS
            </div>

            {[
              { ratio: "10:1+", grade: "HOME RUN", color: "#c8a96e", action: "Maximum size. Swing with full conviction." },
              { ratio: "5–10:1", grade: "EXCELLENT", color: "#7eb8a4", action: "Large position. Press if working." },
              { ratio: "3–5:1", grade: "ACCEPTABLE", color: "#8a8a8a", action: "Standard sizing. Monitor closely." },
              { ratio: "2–3:1", grade: "MARGINAL", color: "#c4756a", action: "Small position only. High bar to add." },
              { ratio: "<2:1", grade: "REJECT", color: "#ff4466", action: "Do not enter. This is not asymmetric." },
            ].map((row) => (
              <div key={row.ratio} style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "9px 12px",
                marginBottom: 4,
                background: "#090a0b",
                border: "1px solid #141414",
                borderLeft: `3px solid ${row.color}`,
                borderRadius: 2,
              }}>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <div style={{ fontSize: 13, color: "#d4c9b8", fontFamily: "monospace", fontWeight: 700, width: 60 }}>{row.ratio}</div>
                  <div style={{ fontSize: 10, color: row.color, letterSpacing: 1, fontFamily: "monospace" }}>{row.grade}</div>
                </div>
                <div style={{ fontSize: 11, color: "#6a6258" }}>{row.action}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: "1px solid #141414",
        padding: "12px 32px",
        display: "flex",
        justifyContent: "space-between",
        background: "#090a0b",
      }}>
        <div style={{ fontSize: 9, color: "#2a2a2a", fontFamily: "monospace", letterSpacing: 2 }}>
          DRUCKENMILLER SOUL v1.0 · ACP AGENT SCHEMA
        </div>
        <div style={{ fontSize: 9, color: "#2a2a2a", fontFamily: "monospace" }}>
          cron: 0 6 * * * · DAILY PRE-MARKET
        </div>
      </div>
    </div>
  );
}
