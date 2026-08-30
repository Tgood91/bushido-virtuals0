import type { ExecuteJobResult } from "../../../runtime/offeringTypes.js";

/**
 * Druckenmiller Agent Job: Soul Schema
 * cron: "0 6 * * *"  — Daily at 06:00 UTC (pre-market)
 *
 * Stanley Druckenmiller managed money for 30 years without a single
 * losing year. His edge was not diversification — it was concentration
 * when conviction was highest, combined with the willingness to be
 * completely wrong and exit immediately.
 *
 * "I've learned many things from George Soros, but perhaps the most
 * important thing is that it's not whether you're right or wrong
 * that's important, but how much money you make when you're right
 * and how much you lose when you're wrong."
 *
 * Core philosophy:
 *   — Macro first. Everything starts with the macro regime.
 *   — Liquidity drives markets. Follow the money supply, not the news.
 *   — Asymmetric bets only. Never bet big unless the reward vastly exceeds risk.
 *   — Concentration into highest conviction. Do not diversify conviction away.
 *   — Size up when right. The biggest mistake is undersizing a winning position.
 *   — Cut instantly when wrong. There is no such thing as a small loss that grew.
 *   — Earnings revisions are the most reliable stock signal in existence.
 *   — The Fed is God. Central bank policy determines everything.
 *   — Be early. By the time it's consensus, the move is over.
 *
 * This soul schema generates:
 *   1. Macro regime assessment (liquidity, rates, USD trend)
 *   2. Conviction scoring for active positions (1–10)
 *   3. Asymmetry audit (reward/risk ratio per position)
 *   4. Concentration check (are we sized for our best ideas?)
 *   5. Behavioral audit (are we acting like Druckenmiller or like everyone else?)
 *   6. Daily thesis statement
 *
 * Example request:
 * {
 *   "cycle_number": 12,
 *   "account_equity": 50000,
 *   "high_water_mark": 52000,
 *   "macro_inputs": {
 *     "fed_stance": "hawkish",          // "hawkish" | "neutral" | "dovish"
 *     "yield_curve": "inverted",        // "normal" | "flat" | "inverted"
 *     "dxy_trend": "up",                // "up" | "down" | "flat"
 *     "m2_growth_yoy": -2.1,            // % YoY money supply growth
 *     "risk_appetite": "risk_off",      // "risk_on" | "neutral" | "risk_off"
 *     "btc_dominance_trend": "rising",  // rising = altcoins losing, macro risk_off
 *   },
 *   "positions": [
 *     {
 *       "asset": "ETH",
 *       "direction": "long",
 *       "conviction": 8,           // your conviction 1-10
 *       "entry_price": 3200,
 *       "current_price": 3450,
 *       "target_price": 5000,
 *       "stop_price": 2900,
 *       "size_pct_portfolio": 18,  // % of portfolio
 *       "thesis": "ETH monetary premium expansion, staking yield, L2 fee growth",
 *       "days_held": 14,
 *       "thesis_intact": true
 *     }
 *   ],
 *   "recent_decisions": [
 *     { "decision": "Doubled ETH on pullback to support", "outcome": "working" },
 *     { "decision": "Held SOL despite breaking trend", "outcome": "cost 3%" }
 *   ],
 *   "best_idea_sized_correctly": true,  // is your highest conviction position your largest?
 *   "passed_on_opportunities": 1,       // valid setups not taken due to hesitation
 * }
 */

// ─── DRUCKENMILLER PRINCIPLES ────────────────────────────────────────────────

interface Principle {
  id: string;
  name: string;
  quote: string;
  description: string;
  audit_questions: string[];
  failure_modes: string[];
}

const DRUCKENMILLER_PRINCIPLES: Principle[] = [
  {
    id: "macro_first",
    name: "Macro Is the Prime Mover",
    quote: "Earnings don't move the overall market; it's the Federal Reserve Board. Focus on the central banks and focus on the movement of liquidity.",
    description:
      "Every position must be contextualized within the current macro regime. Liquidity — money supply, central bank policy, credit conditions — is the tide that lifts or sinks all boats. A great stock in a liquidity drought underperforms. A mediocre asset in a liquidity flood can 10×. Read the tide before picking the boats.",
    audit_questions: [
      "Is the current macro regime (Fed policy, M2, yield curve) supportive of the position?",
      "Has the liquidity backdrop changed since entry?",
      "Are positions aligned with the prevailing monetary trend?",
    ],
    failure_modes: [
      "Being net long in a liquidity contraction (Fed hiking, M2 declining)",
      "Fighting the central bank — the Fed has infinite ammunition",
      "Ignoring yield curve signals because individual asset thesis feels compelling",
    ],
  },
  {
    id: "asymmetry",
    name: "Asymmetric Bets Only",
    quote: "The way to build long-term returns is through preservation of capital and home runs. You can be wrong 30 percent of the time and still make a fortune if you structure your bets asymmetrically.",
    description:
      "Never enter a position where the reward does not vastly exceed the risk. A 2:1 reward/risk is acceptable. A 5:1 is excellent. A 10:1+ is a home run setup. Druckenmiller waited for these. When they appeared, he swung with full conviction. The number of bets matters less than the quality and sizing of each one.",
    audit_questions: [
      "Is every position's reward/risk ratio ≥ 3:1?",
      "Are position sizes proportional to asymmetry — bigger bets on better asymmetry?",
      "Have any positions degraded to <2:1 reward/risk without being resized or closed?",
    ],
    failure_modes: [
      "Entering a 1.5:1 setup because of narrative excitement",
      "Letting a winner run to where reward/risk is no longer asymmetric without taking profits",
      "Sizing a 10:1 setup the same as a 2:1 setup — this is the biggest mistake",
    ],
  },
  {
    id: "concentration",
    name: "Concentrate Into Conviction",
    quote: "Diversification is for people who don't know what they're doing. If you have a great idea, bet on it. Don't dilute it.",
    description:
      "The best trade of the year deserves to be the largest position. Mediocre ideas should be small or absent. The goal is maximum exposure to your best idea, not balanced exposure to many ideas. When Druckenmiller bet against the British pound, he put on $10B. He did not spread across 20 currency pairs.",
    audit_questions: [
      "Is the highest-conviction position the largest position?",
      "Are there too many small positions diluting the portfolio's focus?",
      "If the best idea worked perfectly, would it move the portfolio meaningfully?",
    ],
    failure_modes: [
      "Having 15 positions of equal size — this is not a portfolio, it is a mutual fund",
      "Capping the best idea at 5% to 'manage risk' while it has 10:1 asymmetry",
      "Adding mediocre positions to feel active",
    ],
  },
  {
    id: "size_up_winners",
    name: "Size Up When Right",
    quote: "It's not whether you're right or wrong, but how much money you make when you're right and how much you lose when you're wrong.",
    description:
      "When a position is working and the thesis is intact, add to it. Most traders take profits early and watch their best ideas run without them. Druckenmiller did the opposite — he pressed winning positions aggressively. Compounding on a working thesis is the engine of extraordinary returns.",
    audit_questions: [
      "Have winning positions been added to while the thesis remains intact?",
      "Were profits taken too early, cutting positions before they ran fully?",
      "Is there capacity to add to winning positions within risk constraints?",
    ],
    failure_modes: [
      "Taking 20% profits on a position with a 5:1 thesis intact",
      "Not adding to a winner because it has already moved",
      "Reducing a winning position to 'lock in gains' when nothing has changed",
    ],
  },
  {
    id: "cut_instantly",
    name: "Cut Losses Instantly and Without Emotion",
    quote: "I never had a major loss in my career that didn't start as a small loss that I let get out of hand.",
    description:
      "The moment the thesis breaks, exit. Not when it feels better. Not after one more day. Immediately. A thesis breaks when: the macro regime shifts against the position, a fundamental event invalidates the original reasoning, or the price action tells you the market knows something you don't. Ego has no place in the exit decision.",
    audit_questions: [
      "Were all thesis-breaking events acted upon immediately?",
      "Are there any positions being held after the original thesis became invalid?",
      "Was the largest loss in recent history a position that started small and grew?",
    ],
    failure_modes: [
      "Holding a position after the thesis broke 'to see if it recovers'",
      "Adding to a losing position to average down",
      "Making a small loss a large one by waiting for 'one more day'",
    ],
  },
  {
    id: "earnings_revisions",
    name: "Earnings Revisions Are the Edge",
    quote: "The most reliable signal I have found in equities over 40 years is earnings estimate revisions. When estimates start rising, buy. When they start falling, sell or short.",
    description:
      "For equities and equity-like crypto assets, earnings revisions (or their crypto equivalent: revenue revisions, protocol fee revisions, TVL trajectory changes) are the most durable signal. The market rerates assets based on changing fundamental expectations. Be early to the revision, not late to the consensus.",
    audit_questions: [
      "For each position: is the fundamental trajectory improving or deteriorating?",
      "Are positions on the right side of the earnings/revenue revision cycle?",
      "Is there a position held where fundamentals are declining but price hasn't reflected it yet?",
    ],
    failure_modes: [
      "Buying an asset after consensus has already raised estimates",
      "Holding an asset through a deteriorating fundamental trend hoping for reversal",
      "Not shorting a structurally declining asset because the narrative sounds good",
    ],
  },
  {
    id: "be_early",
    name: "Be Early or Be Wrong",
    quote: "By the time it's on the front page of the newspaper, the move is over. I want to be in before anyone is talking about it.",
    description:
      "Consensus trades are crowded, low-return bets. Druckenmiller's edge was identifying macro and micro shifts before they were recognized. In crypto: this means finding chain-level TVL inflections, narrative shifts, and token catalyst events before they appear on CT. When the trade is on every thread, it is too late.",
    audit_questions: [
      "Are current positions early to a theme or late to a consensus?",
      "Is there a macro or narrative shift forming that has not yet been priced?",
      "Are any positions being held that have become 'popular trades'?",
    ],
    failure_modes: [
      "Entering a position because it appeared in a newsletter",
      "Holding a position because the narrative is strong when price has already moved 3×",
      "Waiting for confirmation that everyone else has seen before entering",
    ],
  },
  {
    id: "thesis_or_exit",
    name: "Thesis or Exit — There Is No Third Option",
    quote: "I can be wrong, I can change my mind completely, but I can't be uncertain. Uncertainty means you have no position. If you have a position, you have a thesis.",
    description:
      "Every position must have a clear, written thesis with specific conditions that would invalidate it. There are only two states: thesis intact → hold or add; thesis broken → exit immediately. 'I'm not sure' is not a reason to hold. Uncertainty is cash.",
    audit_questions: [
      "Does every open position have a clear, current thesis?",
      "Are exit conditions pre-defined for each position?",
      "Is there any position where the original thesis can no longer be stated clearly?",
    ],
    failure_modes: [
      "Holding a position because you're 'not sure' whether to exit",
      "A thesis that has evolved from the original without formal reassessment",
      "Positions without defined invalidation criteria",
    ],
  },
];

// ─── MACRO REGIME ENGINE ─────────────────────────────────────────────────────

type MacroRegime = "RISK_ON_BULL" | "RISK_ON_FRAGILE" | "TRANSITIONAL" | "RISK_OFF_BEAR" | "CRISIS";

interface MacroAssessment {
  regime: MacroRegime;
  regime_label: string;
  liquidity_score: number;    // 0–10 (10 = abundant liquidity)
  rate_headwind: boolean;
  usd_risk: "TAILWIND" | "NEUTRAL" | "HEADWIND";
  btc_macro_read: string;
  positioning_bias: "AGGRESSIVE_LONG" | "MODERATE_LONG" | "NEUTRAL" | "MODERATE_SHORT" | "AGGRESSIVE_SHORT";
  max_gross_exposure_pct: number;
  druckenmiller_take: string;
}

function assessMacroRegime(macro: Record<string, any>): MacroAssessment {
  const fed = (macro.fed_stance || "neutral").toLowerCase();
  const curve = (macro.yield_curve || "flat").toLowerCase();
  const dxy = (macro.dxy_trend || "flat").toLowerCase();
  const m2Growth = Number(macro.m2_growth_yoy || 0);
  const riskAppetite = (macro.risk_appetite || "neutral").toLowerCase();
  const btcDom = (macro.btc_dominance_trend || "flat").toLowerCase();

  let liquidityScore = 5;
  if (fed === "dovish") liquidityScore += 3;
  if (fed === "hawkish") liquidityScore -= 3;
  if (m2Growth > 5) liquidityScore += 2;
  if (m2Growth < 0) liquidityScore -= 2;
  if (curve === "normal") liquidityScore += 1;
  if (curve === "inverted") liquidityScore -= 1;
  liquidityScore = Math.max(0, Math.min(10, liquidityScore));

  const regime: MacroRegime =
    liquidityScore >= 8 && riskAppetite === "risk_on"
      ? "RISK_ON_BULL"
      : liquidityScore >= 6 && riskAppetite !== "risk_off"
      ? "RISK_ON_FRAGILE"
      : liquidityScore >= 4
      ? "TRANSITIONAL"
      : liquidityScore >= 2
      ? "RISK_OFF_BEAR"
      : "CRISIS";

  const regimeLabels: Record<MacroRegime, string> = {
    RISK_ON_BULL: "Risk-On Bull — Maximum Offense",
    RISK_ON_FRAGILE: "Risk-On Fragile — Selective Offense",
    TRANSITIONAL: "Transitional — Reduce Exposure, Wait for Clarity",
    RISK_OFF_BEAR: "Risk-Off Bear — Defensive / Net Short",
    CRISIS: "Crisis — Capital Preservation Only",
  };

  const positioning: MacroAssessment["positioning_bias"] =
    regime === "RISK_ON_BULL"
      ? "AGGRESSIVE_LONG"
      : regime === "RISK_ON_FRAGILE"
      ? "MODERATE_LONG"
      : regime === "TRANSITIONAL"
      ? "NEUTRAL"
      : regime === "RISK_OFF_BEAR"
      ? "MODERATE_SHORT"
      : "AGGRESSIVE_SHORT";

  const maxExposure =
    regime === "RISK_ON_BULL" ? 200 :    // 2× leverage acceptable
    regime === "RISK_ON_FRAGILE" ? 150 :
    regime === "TRANSITIONAL" ? 80 :
    regime === "RISK_OFF_BEAR" ? 60 :
    30;

  const btcMacroRead =
    btcDom === "rising" && riskAppetite === "risk_off"
      ? "BTC dominance rising into risk-off = altcoin weakness confirmed. Hold BTC if any crypto. Exit alt exposure."
      : btcDom === "falling" && riskAppetite === "risk_on"
      ? "BTC dominance falling = altcoin season. Rotate into high-beta L1s and ecosystem tokens."
      : "BTC dominance neutral — no strong rotation signal. Focus on individual thesis strength.";

  const druckenmillerTake =
    regime === "RISK_ON_BULL"
      ? "The Fed is with us. Liquidity is abundant. This is the time to press winning positions and size up conviction. Do not be afraid of your best idea."
      : regime === "RISK_ON_FRAGILE"
      ? "Conditions are favorable but fragile. Be long your best ideas, but keep stops tight. The regime can flip quickly. Stay alert for liquidity deterioration."
      : regime === "TRANSITIONAL"
      ? "The macro is unclear. In ambiguity, reduce size. The best trade in a transitional regime is often to wait. Cash earns yield. Bad trades lose capital."
      : regime === "RISK_OFF_BEAR"
      ? "The Fed is working against us. Liquidity is contracting. This is not the time to fight the tide. Reduce longs. Find short opportunities. Preserve capital ruthlessly."
      : "Crisis conditions. Capital preservation is the only mandate. Exit all but the highest-conviction longs. Cash is a position and right now it is the best position.";

  return {
    regime,
    regime_label: regimeLabels[regime],
    liquidity_score: liquidityScore,
    rate_headwind: fed === "hawkish",
    usd_risk: dxy === "up" ? "HEADWIND" : dxy === "down" ? "TAILWIND" : "NEUTRAL",
    btc_macro_read: btcMacroRead,
    positioning_bias: positioning,
    max_gross_exposure_pct: maxExposure,
    druckenmiller_take: druckenmillerTake,
  };
}

// ─── POSITION AUDIT ──────────────────────────────────────────────────────────

interface PositionAudit {
  asset: string;
  direction: string;
  conviction: number;
  reward_risk_ratio: number | null;
  asymmetry_grade: "HOME_RUN" | "EXCELLENT" | "ACCEPTABLE" | "MARGINAL" | "REJECT";
  size_vs_conviction: "UNDERSIZED" | "APPROPRIATE" | "OVERSIZED";
  thesis_health: "INTACT" | "WEAKENING" | "BROKEN";
  action: "ADD" | "HOLD" | "TRIM" | "EXIT_NOW";
  days_held: number;
  pnl_pct: number | null;
  druckenmiller_verdict: string;
}

function auditPosition(pos: Record<string, any>, macroRegime: MacroRegime): PositionAudit {
  const entry = Number(pos.entry_price || 0);
  const current = Number(pos.current_price || entry);
  const target = Number(pos.target_price || 0);
  const stop = Number(pos.stop_price || 0);
  const conviction = Number(pos.conviction || 5);
  const sizePct = Number(pos.size_pct_portfolio || 5);
  const thesisIntact = pos.thesis_intact !== false;
  const daysHeld = Number(pos.days_held || 0);
  const direction = (pos.direction || "long").toLowerCase();

  const pnlPct =
    entry > 0 && direction === "long"
      ? ((current - entry) / entry) * 100
      : entry > 0 && direction === "short"
      ? ((entry - current) / entry) * 100
      : null;

  // Reward/risk ratio
  let rrRatio: number | null = null;
  if (entry > 0 && target > 0 && stop > 0) {
    const reward =
      direction === "long" ? target - current : current - target;
    const risk =
      direction === "long" ? current - stop : stop - current;
    rrRatio = risk > 0 ? Math.round((reward / risk) * 10) / 10 : null;
  }

  const asymmetryGrade: PositionAudit["asymmetry_grade"] =
    rrRatio == null ? "ACCEPTABLE" :
    rrRatio >= 8 ? "HOME_RUN" :
    rrRatio >= 4 ? "EXCELLENT" :
    rrRatio >= 2.5 ? "ACCEPTABLE" :
    rrRatio >= 1.5 ? "MARGINAL" : "REJECT";

  // Conviction-to-size alignment
  // Rule: conviction 8–10 → 15–25%+, conviction 5–7 → 5–15%, conviction <5 → 0–5%
  const expectedMinSize =
    conviction >= 8 ? 15 : conviction >= 5 ? 5 : 0;
  const expectedMaxSize =
    conviction >= 8 ? 35 : conviction >= 5 ? 15 : 5;

  const sizeVsConviction: PositionAudit["size_vs_conviction"] =
    sizePct < expectedMinSize ? "UNDERSIZED" :
    sizePct > expectedMaxSize ? "OVERSIZED" :
    "APPROPRIATE";

  // Thesis health
  const thesisHealth: PositionAudit["thesis_health"] =
    !thesisIntact ? "BROKEN" :
    (macroRegime === "RISK_OFF_BEAR" || macroRegime === "CRISIS") && direction === "long" ? "WEAKENING" :
    (macroRegime === "RISK_ON_BULL") && direction === "short" ? "WEAKENING" :
    "INTACT";

  // Action
  const action: PositionAudit["action"] =
    thesisHealth === "BROKEN" ? "EXIT_NOW" :
    asymmetryGrade === "REJECT" ? "EXIT_NOW" :
    thesisHealth === "INTACT" && conviction >= 8 && sizeVsConviction === "UNDERSIZED" ? "ADD" :
    thesisHealth === "WEAKENING" ? "TRIM" :
    "HOLD";

  // Druckenmiller verdict
  const verdicts: Record<PositionAudit["action"], string> = {
    ADD: `Conviction ${conviction}/10 with thesis intact and ${rrRatio?.toFixed(1) ?? "?"}:1 reward/risk. This is UNDERSIZED. Druckenmiller would press this position. Size up.`,
    HOLD: `Thesis intact. Reward/risk ${rrRatio?.toFixed(1) ?? "?"}:1. Hold and monitor for ADD opportunity on pullbacks.`,
    TRIM: `Thesis weakening — macro regime or fundamentals shifting against position. Trim to core size. Keep stop tight.`,
    EXIT_NOW: `${thesisHealth === "BROKEN" ? "THESIS BROKEN" : "REWARD/RISK UNACCEPTABLE"}. There is no debate here. Exit immediately. "I never had a major loss that didn't start as a small loss I let get out of hand."`,
  };

  return {
    asset: pos.asset || "UNKNOWN",
    direction,
    conviction,
    reward_risk_ratio: rrRatio,
    asymmetry_grade: asymmetryGrade,
    size_vs_conviction: sizeVsConviction,
    thesis_health: thesisHealth,
    action,
    days_held: daysHeld,
    pnl_pct: pnlPct != null ? Math.round(pnlPct * 100) / 100 : null,
    druckenmiller_verdict: verdicts[action],
  };
}

// ─── BEHAVIORAL AUDIT ────────────────────────────────────────────────────────

interface BehaviorAudit {
  score: number;           // 0–100
  grade: "DRUCKENMILLER" | "DISCIPLINED" | "DEVELOPING" | "DRIFTING" | "AMATEUR";
  flags: string[];
  commendations: string[];
}

function auditBehavior(request: Record<string, any>, positionAudits: PositionAudit[]): BehaviorAudit {
  const flags: string[] = [];
  const commendations: string[] = [];
  let score = 100;

  // Best idea sizing
  if (!request.best_idea_sized_correctly) {
    score -= 15;
    flags.push("Highest-conviction position is NOT the largest — this is the most common and most expensive mistake in portfolio construction");
  } else {
    commendations.push("Best idea is correctly sized — conviction maps to capital allocation");
  }

  // Passed on opportunities
  const passedOn = Number(request.passed_on_opportunities || 0);
  if (passedOn > 0) {
    score -= passedOn * 8;
    flags.push(`${passedOn} valid opportunity(s) passed on due to hesitation — Druckenmiller: "The biggest mistake is not being in your best idea"`);
  }

  // Recent decisions
  const decisions: Array<{ decision: string; outcome: string }> = request.recent_decisions || [];
  for (const d of decisions) {
    const dec = d.decision.toLowerCase();
    const out = d.outcome.toLowerCase();
    if (dec.includes("averaged down") || dec.includes("added to losing")) {
      score -= 20;
      flags.push(`Adding to losing position: "${d.decision}" — this violates the single most important risk rule`);
    }
    if (dec.includes("held") && (out.includes("cost") || out.includes("loss"))) {
      score -= 10;
      flags.push(`Held past the thesis break point: "${d.decision}" — early exits are always cheaper`);
    }
    if (dec.includes("doubled") && out.includes("working")) {
      commendations.push(`Pressed a winning position: "${d.decision}" — this is Druckenmiller-level execution`);
    }
  }

  // Exit-now positions still held
  const exitNowCount = positionAudits.filter((p) => p.action === "EXIT_NOW").length;
  if (exitNowCount > 0) {
    score -= exitNowCount * 15;
    flags.push(`${exitNowCount} position(s) require immediate exit — every hour these are held is a behavioral failure`);
  }

  // Undersized winners
  const undersizedHighConviction = positionAudits.filter(
    (p) => p.size_vs_conviction === "UNDERSIZED" && p.conviction >= 8 && p.thesis_health === "INTACT"
  );
  if (undersizedHighConviction.length > 0) {
    score -= undersizedHighConviction.length * 10;
    flags.push(
      `${undersizedHighConviction.length} high-conviction position(s) are undersized: ${undersizedHighConviction.map((p) => p.asset).join(", ")} — size up or conviction isn't real`
    );
  }

  score = Math.max(0, score);

  const grade: BehaviorAudit["grade"] =
    score >= 90 ? "DRUCKENMILLER" :
    score >= 75 ? "DISCIPLINED" :
    score >= 55 ? "DEVELOPING" :
    score >= 35 ? "DRIFTING" :
    "AMATEUR";

  return { score, grade, flags, commendations };
}

// ─── DAILY THESIS ────────────────────────────────────────────────────────────

const DRUCKENMILLER_QUOTES = [
  "The way to build long-term returns is through preservation of capital and home runs.",
  "It's not whether you're right or wrong, but how much money you make when you're right.",
  "I never had a major loss in my career that didn't start as a small loss I let get out of hand.",
  "Earnings don't move the overall market. It's the Federal Reserve Board.",
  "I've learned that a big part of Wall Street is a waste of time.",
  "The first thing I heard when I got in the business was bulls make money, bears make money, and pigs get slaughtered. I'm here to tell you I was a pig.",
  "You have to be willing to take losses. Nobody bats a thousand.",
  "The key is not to be right, but to make money when you're right.",
  "If I'm wrong, I'm out. If I'm right, I press.",
  "Cash combined with courage in a time of crisis is priceless.",
  "Concentrate your portfolio. Great investors are not widely diversified.",
  "When you have tremendous conviction on a trade, you have to go for the jugular.",
  "The way to make money is to anticipate, not to follow.",
  "Don't ever, ever, ever, ever average down in a bear market.",
];

// ─── MAIN ────────────────────────────────────────────────────────────────────

export async function executeJob(
  request: Record<string, any>
): Promise<ExecuteJobResult> {
  const cycleNumber = Number(request.cycle_number || 1);
  const equity = Number(request.account_equity || 50000);
  const hwm = Number(request.high_water_mark || equity);
  const drawdownPct = Math.max(0, ((hwm - equity) / hwm) * 100);

  // ── Macro assessment ──
  const macroInputs = request.macro_inputs || {};
  const macroAssessment = assessMacroRegime(macroInputs);

  // ── Position audits ──
  const positions: Record<string, any>[] = request.positions || [];
  const positionAudits: PositionAudit[] = positions.map((p) =>
    auditPosition(p, macroAssessment.regime)
  );

  // ── Behavioral audit ──
  const behaviorAudit = auditBehavior(request, positionAudits);

  // ── Concentration check ──
  const sortedByConviction = [...positionAudits].sort(
    (a, b) => b.conviction - a.conviction
  );
  const highestConvictionPos = sortedByConviction[0];
  const positionsBySizeDesc = [...positions].sort(
    (a, b) =>
      Number(b.size_pct_portfolio || 0) - Number(a.size_pct_portfolio || 0)
  );
  const largestPos = positionsBySizeDesc[0];
  const concentrationAligned =
    !highestConvictionPos ||
    !largestPos ||
    highestConvictionPos.asset === largestPos.asset;

  // ── Portfolio heat ──
  const totalExposure = positions.reduce(
    (sum, p) => sum + Number(p.size_pct_portfolio || 0),
    0
  );
  const exposureVsMax =
    totalExposure > macroAssessment.max_gross_exposure_pct
      ? "OVER_LIMIT"
      : totalExposure > macroAssessment.max_gross_exposure_pct * 0.85
      ? "NEAR_LIMIT"
      : "WITHIN_LIMIT";

  // ── Daily thesis statement ──
  const exitNowPositions = positionAudits.filter((p) => p.action === "EXIT_NOW");
  const addPositions = positionAudits.filter((p) => p.action === "ADD");

  const dailyThesis =
    exitNowPositions.length > 0
      ? `PRIORITY: Exit ${exitNowPositions.map((p) => p.asset).join(", ")} immediately. Thesis broken or asymmetry gone. No other action until these are closed.`
      : addPositions.length > 0
      ? `CONVICTION SIZING: ${addPositions.map((p) => p.asset).join(", ")} ${addPositions.length === 1 ? "is" : "are"} undersized relative to conviction. Today's primary action: press ${addPositions[0].asset}.`
      : macroAssessment.regime === "TRANSITIONAL"
      ? "MACRO UNCERTAINTY: Reduce gross exposure. Do not add new positions. Wait for the regime to clarify."
      : "HOLD AND MONITOR: Portfolio is positioned correctly. Watch for macro regime changes. Add to winners on pullbacks.";

  // ── Closing quote ──
  const quote = DRUCKENMILLER_QUOTES[cycleNumber % DRUCKENMILLER_QUOTES.length];

  // ── Summary ──
  const summary =
    `Druckenmiller Soul — Cycle ${cycleNumber}. ` +
    `Macro: ${macroAssessment.regime_label}. ` +
    `Liquidity: ${macroAssessment.liquidity_score}/10. ` +
    `Behavior: ${behaviorAudit.grade} (${behaviorAudit.score}/100). ` +
    `${exitNowPositions.length} exit(s) required. ` +
    `${addPositions.length} position(s) to press. ` +
    `Thesis: ${dailyThesis}`;

  return {
    deliverable: JSON.stringify({
      schema: "druckenmiller_soul",
      agent: "Druckenmiller",
      generated_at: new Date().toISOString(),
      cycle_number: cycleNumber,
      summary,

      // Macro
      macro: macroAssessment,

      // Portfolio
      portfolio: {
        equity_usd: equity,
        high_water_mark_usd: hwm,
        drawdown_pct: Math.round(drawdownPct * 100) / 100,
        total_exposure_pct: Math.round(totalExposure),
        max_exposure_pct: macroAssessment.max_gross_exposure_pct,
        exposure_status: exposureVsMax,
        concentration_aligned: concentrationAligned,
        concentration_warning: concentrationAligned
          ? null
          : `Highest conviction (${highestConvictionPos?.asset}) is not largest position (${largestPos?.asset}). Fix this.`,
        position_count: positions.length,
      },

      // Positions
      position_audits: positionAudits,
      exits_required: exitNowPositions,
      positions_to_press: addPositions,

      // Behavior
      behavior: behaviorAudit,

      // Principles reference
      principles: DRUCKENMILLER_PRINCIPLES.map((p) => ({
        id: p.id,
        name: p.name,
        quote: p.quote,
        description: p.description,
      })),

      // Daily mandate
      daily_thesis: dailyThesis,
      daily_quote: quote,

      // Context for agent system prompt
      agent_instructions: {
        persona: "You are an AI agent inspired by Stanley Druckenmiller — the greatest macro trader of all time. You think in macro regimes first. You bet asymmetrically. You concentrate into conviction. You cut losses the moment the thesis breaks. You press winners without hesitation.",
        core_rules: [
          "Never enter a position without a stated, specific thesis and exit conditions",
          "Reward/risk must be ≥ 3:1 for any new position",
          "Highest conviction idea must be largest position",
          "Exit immediately when thesis breaks — do not wait for confirmation",
          "Follow the Fed — liquidity determines the regime, the regime determines the playbook",
          "Do not average down. Ever.",
          "When right, press. Undersizing winners is as costly as holding losers.",
          "Be early. Consensus trades have no edge.",
        ],
      },
    }),
  };
}
